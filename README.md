[![npm version](https://badge.fury.io/js/slate-md-serializer.svg)](https://badge.fury.io/js/slate-md-serializer) [![CircleCI](https://circleci.com/gh/tommoor/slate-md-serializer.svg?style=svg)](https://circleci.com/gh/tommoor/slate-md-serializer)

# Slate Markdown Serializer

A Markdown serializer for the [Slate Editor](http://slatejs.org). Requires Slate 0.32+.

## renderMark

This serializer supports the following Slate marks:

```javascript
function renderMark(props) {
  switch (props.mark.type) {
    case 'bold':
      return <strong>{props.children}</strong>
    case 'code':
      return <Code>{props.children}</Code>
    case 'italic':
      return <em>{props.children}</em>
    case 'underlined':
      return <u>{props.children}</u>
    case 'deleted':
      return <del>{props.children}</del>
    case 'added':
      return <mark>{props.children}</mark>
    default:
  }
}
```

## renderNode

This serializer supports the following Slate node keys:

```javascript
function renderNode(props) {
  const {attributes} = props

  switch (props.node.type) {
    case 'paragraph':
      return <Paragraph {...props} />
    case 'block-quote':
      return <blockquote {...attributes}>{props.children}</blockquote>
    case 'bulleted-list':
      return <ul {...attributes}>{props.children}</ul>
    case 'ordered-list':
      return <ol {...attributes}>{props.children}</ol>
    case 'todo-list':
      return <ul {...attributes}>{props.children}</ul>
    case 'table':
      return <table {...attributes}>{props.children}</table>
    case 'table-row':
      return <tr {...attributes}>{props.children}</tr>
    case 'table-head':
      return <th {...attributes}>{props.children}</th>
    case 'table-cell':
      return <td {...attributes}>{props.children}</td>
    case 'list-item':
      return <li {...attributes}>{props.children}</li>
    case 'horizontal-rule':
      return <hr />
    case 'code':
      return <code {...attributes}>{props.children}</code>
    case 'image':
      return <img src={props.src} title={props.title} />
    case 'link':
      return <a href={props.href}>{props.children}</a>
    case 'heading1':
      return <h1 {...attributes}>{props.children}</h1>
    case 'heading2':
      return <h2 {...attributes}>{props.children}</h2>
    case 'heading3':
      return <h3 {...attributes}>{props.children}</h3>
    case 'heading4':
      return <h4 {...attributes}>{props.children}</h4>
    case 'heading5':
      return <h5 {...attributes}>{props.children}</h5>
    case 'heading6':
      return <h6 {...attributes}>{props.children}</h6>
    default:
  }
}
```
