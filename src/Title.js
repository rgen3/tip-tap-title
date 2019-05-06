import { Node, Plugin } from 'tiptap'
import {
  setBlockType,
  textblockTypeInputRule,
  toggleBlockType
} from 'tiptap-commands'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Transaction } from 'prosemirror-state'

const NODE_NAME = 'title'
const BreakException = {}

export default class Title extends Node {
  get name() {
    return NODE_NAME
  }

  get defaultOptions() {
    return {
      emptyClass: 'article-empty-title',
      placeholder: 'Write a title',
      paragraphPlaceholder: 'Great thoughts starts here...',
      headingClass: NODE_NAME
    }
  }

  get schema() {
    const { headingClass } = this.options
    return {
      content: 'inline*',
      group: 'block',
      parseDOM: [
        {
          tag: `h1.${headingClass}`
        }
      ],
      toDOM: node => ['h1', { class: 'article-title' }, 0]
    }
  }

  get plugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, oldState, newState) => {
          if (newState.doc.firstChild.type.name !== NODE_NAME) {
            return newState.tr
              .replaceWith(0, 0, newState.schema.nodes.title.create())
              .setMeta({})
          }

          let startFrom = 0
          let transaction = false
          try {
            newState.doc.content.content.forEach((item, start) => {
              if (start > 0 && item.type.name === NODE_NAME) {
                const { content } = item.content
                transaction = newState.tr
                  .replaceWith(
                    startFrom,
                    startFrom + item.nodeSize,
                    newState.schema.nodes.paragraph.create()
                  )
                  .insertText(content[0].text)
              }
              if (transaction) {
                throw BreakException
              }
              startFrom += item.nodeSize
            })
          } catch (err) {
            if (err !== BreakException) {
              throw err
            }
          }

          return transaction
        },
        props: {
          decorations: ({ doc, plugins }) => {
            const decorations = []
            const { textContent, childCount } = doc.firstChild
            const {
              emptyClass,
              placeholder,
              paragraphPlaceholder
            } = this.options
            const editablePlugin = plugins.find(plugin =>
              plugin.key.startsWith('editable$')
            )
            const editable = editablePlugin.props.editable()

            if (
              editable &&
              textContent === '' &&
              childCount === 0 &&
              doc.firstChild.type.name === NODE_NAME
            ) {
              const decoration = Decoration.node(0, doc.firstChild.nodeSize, {
                class: emptyClass,
                'data-placeholder': placeholder
              })
              decorations.push(decoration)
            }

            const secondNode = doc.maybeChild(1)
            if (!editable || !secondNode) {
              return false
            }

            const neededNode =
              secondNode &&
              secondNode.type.name === 'paragraph' &&
              secondNode.textContent === '' &&
              secondNode.content.childCount === 0 &&
              doc.content.childCount <= 2

            doc.descendants((node, pos) => {
              if (!neededNode || node !== secondNode) {
                return
              }

              const decoration = Decoration.node(pos, pos + node.nodeSize, {
                class: emptyClass,
                'data-placeholder': paragraphPlaceholder
              })
              decorations.push(decoration)
            })

            return DecorationSet.create(doc, decorations)
          }
        }
      })
    ]
  }
}
