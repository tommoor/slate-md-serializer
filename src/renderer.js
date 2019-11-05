import {encode} from './urls'
import {escapeMarkdownChars} from './utils'
import parser from './parser'
import {Record} from 'immutable'
import {Value} from 'slate'

const String = new Record({
  object: 'string',
  text: ''
})

/**
 * Rules to (de)serialize nodes.
 *
 * @type {Object}
 */

let tableHeader = ''

const RULES = [
  {
    serialize(obj, children) {
      if (obj.object === 'string') {
        return children
      }
    }
  },
  {
    serialize(obj, children, document) {
      if (obj.object !== 'block') return
      const parent = document.getParent(obj.key)

      switch (obj.type) {
        case 'table':
          tableHeader = ''

          return `${children.trim()}\n`
        case 'table-head': {
          switch (obj.getIn(['data', 'align'])) {
            case 'left':
              tableHeader += '|:--- '
              break
            case 'center':
              tableHeader += '|:---:'
              break
            case 'right':
              tableHeader += '| ---:'
              break
            default:
              tableHeader += '| --- '
          }

          return `| ${children} `
        }

        case 'table-row': {
          let output = ''

          if (tableHeader) {
            output = `${tableHeader}|\n`
            tableHeader = ''
          }

          return `${children}|\n${output}`
        }

        case 'table-cell':
          return `| ${children} `
        case 'paragraph':
          return `${children}\n`
        case 'code': {
          const language = obj.getIn(['data', 'language']) || ''

          return `\`\`\`${language}\n${children.replace(
            /```/g,
            '\\`\\`\\`'
          )}\n\`\`\`\n`
        }

        case 'code-line':
          return `${children.replace(/```/g, '\\`\\`\\`')}\n`
        case 'block-quote':
          // Handle multi-line blockquotes
          return `${children
            .split('\n')
            .map(text => `> ${text}`)
            .join('\n')}\n`
        case 'todo-list':
        case 'bulleted-list':
        case 'ordered-list':
          // Remove excessive newlines.
          return children.replace(/\n+$/, '\n')

        case 'list-item': {
          if (parent.type === 'ordered-list') {
            // There should be enough left pad to align all lines with first one,
            // otherwise some parsers parse the markdown incorrectly.
            const index = (parent.nodes.indexOf(obj) + 1).toString()
            const pad = ' '.repeat(index.length + 2)

            return children
              .replace(/^(.+)/gm, `${pad}$1`)
              .replace(/^\s+/, `${index}. `)
          }

          return children.replace(/^(.+)/gm, '  $1').replace(/^ /, '-')
        }

        case 'heading1':
          return `# ${children}\n`
        case 'heading2':
          return `## ${children}\n`
        case 'heading3':
          return `### ${children}\n`
        case 'heading4':
          return `#### ${children}\n`
        case 'heading5':
          return `##### ${children}\n`
        case 'heading6':
          return `###### ${children}\n`
        case 'horizontal-rule':
          return `---\n`
        case 'image': {
          const alt = obj.getIn(['data', 'alt']) || ''
          const src = encode(obj.getIn(['data', 'src']) || '')
          const title = obj.getIn(['data', 'title']) || ''
          const titleTag = title ? ` "${title}"` : ''

          return `![${alt}](${src}${titleTag})\n`
        }
      }
    }
  },
  {
    serialize(obj, children) {
      if (obj.type === 'hashtag') return children
    }
  },
  {
    serialize(obj, children) {
      if (obj.type === 'link') {
        const href = encode(obj.getIn(['data', 'href']) || '')
        const text = children.trim() || href

        return `[${text}](${href})`
      }
    }
  },
  {
    serialize(obj, children, open, close) {
      if (obj.object !== 'mark') return
      if (!children) return

      switch (obj.type) {
        case 'bold':
          return `${open ? '**' : ''}${children}${close ? '**' : ''}`
        case 'italic':
          return `${open ? '_' : ''}${children}${close ? '_' : ''}`
        case 'code':
          return `\`${children}\``
        case 'inserted':
          return `++${children}++`
        case 'deleted':
          return `~~${children}~~`
        case 'underlined':
          return `__${children}__`
      }
    }
  }
]

/**
 * Markdown serializer.
 *
 * @type {Markdown}
 */

class Markdown {
  /**
   * Create a new serializer with `rules`.
   *
   * @param {Object} options
   * @property {Array} rules
   * @return {Markdown} serializer
   */

  constructor(options = {}) {
    this.rules = [...(options.rules || []), ...RULES]

    this.serializeNode = this.serializeNode.bind(this)
    this.serializeLeaves = this.serializeLeaves.bind(this)
    this.serializeString = this.serializeString.bind(this)
  }

  /**
   * Serialize a `state` object into an HTML string.
   *
   * @param {State} state
   * @return {String} markdown
   */

  serialize(state) {
    const {document} = state
    const elements = document.nodes.map(node =>
      this.serializeNode(node, document)
    )

    return elements.join('\n').trim()
  }

  /**
   * Serialize a `node`.
   *
   * @param {Node} node
   * @return {String}
   */

  serializeNode(node, document, openMarks = {}, prevNode, nextNode) {
    if (node.object === 'text') {
      const inCodeBlock = Boolean(
        document.getClosest(node.key, n => n.type === 'code')
      )
      const inCodeMark = Boolean(
        (node.marks || []).filter(mark => mark.type === 'code').size
      )

      return this.serializeLeaves(
        node,
        !inCodeBlock && !inCodeMark,
        openMarks,
        prevNode,
        nextNode
      )
    }

    const isMultilineListItem =
      node.type === 'list-item' &&
      (node.nodes.size !== 2 ||
        node.nodes.first().type !== 'paragraph' ||
        !['ordered-list', 'bulleted-list', 'todo-list'].includes(
          node.nodes.last().type
        ))

    const children = node.nodes
      .map((childNode, index) => {
        const serialized = this.serializeNode(
          childNode,
          document,
          openMarks,
          node.nodes.get(index - 1),
          node.nodes.get(index + 1)
        )

        return (
          (serialized && serialized.join ? serialized.join('') : serialized) ||
          ''
        )
      })
      .join(
        // Special case for blockquotes && multi-line list items
        node.type === 'block-quote' || isMultilineListItem ? '\n' : ''
      )

    for (const rule of this.rules) {
      if (!rule.serialize) continue
      const ret = rule.serialize(node, children, document)

      if (ret) return ret
    }
  }

  /**
   * Serialize `leaves`.
   *
   * @param {Leave[]} leaves
   * @return {String}
   */

  serializeLeaves(leaves, escape = true, openMarks, prevNode, nextNode) {
    let leavesText = leaves.text

    if (escape) {
      // escape markdown characters
      leavesText = escapeMarkdownChars(leavesText)
    }

    const string = new String({text: leavesText})
    let {marks} = leaves
    const text = this.serializeString(string)

    if (!marks) return text

    const prevNodeMarks =
      prevNode && prevNode.object === 'text' && prevNode.marks
        ? prevNode.marks.reduce((hash, mark) => {
            hash[mark.type] = true

            return hash
          }, {})
        : {}
    const nextNodeMarks =
      nextNode && nextNode.object === 'text' && nextNode.marks
        ? nextNode.marks.reduce((hash, mark) => {
            hash[mark.type] = true

            return hash
          }, {})
        : {}

    // The order of items in the `marks` array matters. The marks that
    // transitioned from the previous node should go last. For some reason,
    // Slate sometimes doesn't respect this order, so we must ensure it by
    // sorting the array ourselves.
    if (Object.keys(prevNodeMarks).length && marks) {
      marks = marks.sort((a, b) => {
        const prevHasA = prevNodeMarks[a.type] ? 1 : -1
        const prevHasB = prevNodeMarks[b.type] ? 1 : -1

        return prevHasA - prevHasB
      })
    }

    return marks.reduce((children, mark) => {
      const close = !nextNodeMarks[mark.type]
      const open = !openMarks[mark.type]

      openMarks[mark.type] = nextNodeMarks[mark.type]

      for (const rule of this.rules) {
        if (!rule.serialize) continue
        const ret = rule.serialize(mark, children, open, close)

        if (ret) return ret
      }

      return undefined
    }, text)
  }

  /**
   * Serialize a `string`.
   *
   * @param {String} string
   * @return {String}
   */

  serializeString(string) {
    for (const rule of this.rules) {
      if (!rule.serialize) continue
      const ret = rule.serialize(string, string.text)

      if (ret) return ret
    }
  }

  /**
   * Deserialize a markdown `string`.
   *
   * @param {String} markdown
   * @return {State} state
   */
  deserialize(markdown) {
    const document = parser.parse(markdown)

    return Value.fromJSON({document})
  }
}

export default Markdown
