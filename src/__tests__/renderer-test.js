import MarkdownRenderer from "../renderer";
const Markdown = new MarkdownRenderer();

// By parsing, rendering and reparsing we can test both sides of the serializer
// at the same time and ensure that parsing / rendering is compatible.
function getNodes(text) {
  const parsed = Markdown.deserialize(text);
  const rendered = Markdown.serialize(parsed);
  const reparsed = Markdown.deserialize(rendered);
  return reparsed.document.nodes;
}

test("parses paragraph", () => {
  const text = "This is just a sentance";
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses two paragraphs", () => {
  const text = `
This is the first sentance
This is the second sentance
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses two paragraphs", () => {
  const text = `
This is the first sentance

This is the second sentance
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("maintains multiple empty paragraphs", () => {
  const text = `
This is the first sentance


Two empty paragraphs above
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses heading1", () => {
  const output = Markdown.deserialize("# Heading");
  expect(output.document.nodes).toMatchSnapshot();
});

test("parses heading2", () => {
  const output = Markdown.deserialize("## Heading");
  expect(output.document.nodes).toMatchSnapshot();
});

test("parses heading3", () => {
  const output = Markdown.deserialize("### Heading");
  expect(output.document.nodes).toMatchSnapshot();
});

test("parses heading4", () => {
  const output = Markdown.deserialize("#### Heading");
  expect(output.document.nodes).toMatchSnapshot();
});

test("parses heading5", () => {
  const output = Markdown.deserialize("##### Heading");
  expect(output.document.nodes).toMatchSnapshot();
});

test("parses heading6", () => {
  const output = Markdown.deserialize("###### Heading");
  expect(output.document.nodes).toMatchSnapshot();
});

test("parses heading without text", () => {
  const output = Markdown.deserialize("## ");
  expect(output.document.nodes).toMatchSnapshot();
});

test("does not parse heading within text", () => {
  const output = Markdown.deserialize("one ## two ");
  expect(output.document.nodes).toMatchSnapshot();
});

test("headings are not greedy about newlines", () => {
  const text = `
a paragraph

## Heading

another paragraph
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses horizontal rule", () => {
  const text = `
---

a paragraph
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("horizontal rule does not make text above a heading", () => {
  const text = `
not a heading
---
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("horizontal rule does not make text above a heading", () => {
  const text = `
not a heading
===
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("bold mark", () => {
  const text = `**this is bold**`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("italic mark", () => {
  const text = `*this is italic* _this is italic too_`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("deleted mark", () => {
  const text = `~~this is strikethrough~~`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("inserted mark", () => {
  const text = `++inserted text++`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("underlined mark", () => {
  const text = `__underlined text__`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("code mark", () => {
  const text = "`const foo = 123;`";
  expect(getNodes(text)).toMatchSnapshot();
});

test("code mark with escaped characters", () => {
  const text = "`<script>alert('foo')</script>`";
  expect(getNodes(text)).toMatchSnapshot();
});

test("does not escape characters inside of code marks", () => {
  const text = "`<script>alert('foo')</script>`";
  const parsed = Markdown.deserialize(text);
  const rendered = Markdown.serialize(parsed);
  expect(rendered).toMatchSnapshot();
});

test("parses quote", () => {
  const text = `
> this is a quote
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses quote followed by list with quote (outline/#723)", () => {
  const text = `
> this is a quote
1. > this is a list item with a quote

> 1. this is a quote with a list item
> 2. this is the second list item
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses quote with newlines and marks", () => {
  const text = `
> this is a *quote*
> this is the second part of the quote
>
> this is the third part of the quote
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("quotes do not get combined", () => {
  const text = `
> this is a quote

> this is a different quote
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("quote is not greedy about newlines", () => {
  const text = `
> this is a quote

this is a paragraph
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses list items", () => {
  const text = `
- one
- two
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses nested list items", () => {
  const text = `
* one
* two
   * nested

next para`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("does not add extra paragraphs around lists", () => {
  const text = `
first paragraph

- list

second paragraph
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses indented list items", () => {
  const text = `
 - one
 - two
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses list items with marks", () => {
  const text = `
 - one **bold**
 - *italic* two
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses ordered list items", () => {
  const text = `
1. one
1. two
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses ordered list items with marks", () => {
  const text = `
1. one **bold**
1. *italic* two
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses ordered list items with different numbers", () => {
  const text = `
1. one
2. two
3. three
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses mixed list items", () => {
  const text = `
1. list

- another

1. different
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses tables", () => {
  const text = `
| Tables   |      Are      |  Cool |
|----------|:-------------:|------:|
| col 1 is |  left-aligned | $1600 |
| col 2 is |    centered   |   $12 |
| col 3 is | right-aligned |    $1 |
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("tables with empty cells remain empty", () => {
  const text = `
|          |               |       |
|----------|:-------------:|------:|
|          |               |       |
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("tables with leading empty cells remain empty", () => {
  const text = `
|          |               | heading |
|----------|:-------------:|--------:|
|          |               | content |
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("tables are not greedy about newlines", () => {
  const text = `
| Tables   |      Are      |  Cool |
|----------|:-------------:|------:|
| col 1 is |  left-aligned | $1600 |

a new paragraph
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("tables allow escaped pipes within", () => {
  const text = `
| Tables   |      Are      |  Cool  |
|----------|:-------------:|-------:|
| col has  |   \\|pipes \\|  | inside |

a new paragraph
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses todo list items", () => {
  const text = `
[ ] todo
[x] done
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses nested todo list items", () => {
  const text = `
[ ] todo
   [ ] nested
   [ ] deep
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses double nested todo list items", () => {
  const text = `
[x] checked
   [ ] empty
   [x] checked

[ ] three
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses todo list items with marks", () => {
  const text = `
 [x] ~~done~~
 [x] more **done**
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses ``` code fences", () => {
  const text = `
\`\`\`
const hello = 'world';
function() {
  return hello;
}
\`\`\`
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses ``` code fences with language", () => {
  const text = `
\`\`\`javascript
const hello = 'world';
function() {
  return hello;
}
\`\`\`
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("does not escape characters inside of code blocks", () => {
  const text = `
\`\`\`
const hello = 'world';
function() {
  return hello;
}
\`\`\`
`;
  const parsed = Markdown.deserialize(text);
  const rendered = Markdown.serialize(parsed);
  expect(rendered).toMatchSnapshot();
});

test("does not parse marks inside of code blocks", () => {
  const text = `
\`\`\`
This is *not* bold, how about __this__
\`\`\`
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("does not parse marks around code block boundaries", () => {
  const text = `
\`\`\`
This is *not
\`\`\`

hello \* bold
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("code is not greedy about newlines", () => {
  const text = `
one sentance

\`\`\`
const hello = 'world';
function() {
  return hello;
}
\`\`\`

two sentance
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses ~~~ code fences", () => {
  const text = `
~~~
const hello = 'world';
function() {
  return hello;
}
~~~
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses indented code blocks", () => {
  const text = `
    const hello = 'world';
    function() {
      return hello;
    }
`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses hashtag", () => {
  const text = `this is a #hashtag example`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses hashtag ignoring dash", () => {
  const text = `dash should end #hashtag-dash`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("hashtag with mark", () => {
  const text = `this is a **#hashtag**`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses image", () => {
  const text = `![example](http://example.com/logo.png)`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses link", () => {
  const text = `[google](http://google.com)`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses link within mark", () => {
  const text = `**[google](http://google.com)**`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses link with encoded characters", () => {
  const text = `[kibana](https://example.com/app/kibana#/discover?_g=%28refreshInterval:%28%27$$hashKey%27:%27object:1596%27,display:%2710%20seconds%27,pause:!f,section:1,value:10000%29,time:%28from:now-15m,mode:quick,to:now%29%29&_a=%28columns:!%28metadata.step,message,metadata.attempt_f,metadata.tries_f,metadata.error_class,metadata.url%29,index:%27logs-%27,interval:auto,query:%28query_string:%28analyze_wildcard:!t,query:%27metadata.at:%20Stepper*%27%29%29,sort:!%28time,desc%29%29)`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses link with percent symbol", () => {
  const text = `[kibana](https://example.com/app/kibana#/visualize/edit/Requests-%)`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("ignores empty link", () => {
  const text = `[empty]()`;
  expect(getNodes(text)).toMatchSnapshot();
});

test("parses empty string", () => {
  expect(getNodes("")).toMatchSnapshot();
});

test("parses whitespace string", () => {
  expect(getNodes("   ")).toMatchSnapshot();
});

test("handles escaped blocks", () => {
  expect(getNodes("\\# text")).toMatchSnapshot();
  expect(getNodes("\\- text")).toMatchSnapshot();
  expect(getNodes("\\* text")).toMatchSnapshot();
});

test("handles escaped marks", () => {
  expect(getNodes("this is \\*\\*not bold\\*\\*")).toMatchSnapshot();
  expect(getNodes("this is \\*not italic\\*")).toMatchSnapshot();
  expect(getNodes("this is \\[not\\]\\(a link\\)")).toMatchSnapshot();
  expect(getNodes("this is \\!\\[not\\]\\(an image\\)")).toMatchSnapshot();
});

// document version 2

function getVersion2(text) {
  const parsed = Markdown.deserialize(text);
  return Markdown.serialize(parsed, { version: 2 });
}

test("tables with empty cells remain as tables", () => {
  const text = `
|          |               |       |
|----------|:-------------:|------:|
|          |               |       |
`;
  expect(getVersion2(text)).toMatchSnapshot();
});

test("removes trailing spaces from end of marks", () => {
  const text = `
_this is italic _ in a sentance
`;
  expect(getVersion2(text)).toMatchSnapshot();
});

test("removes spaces from beginning of marks", () => {
  const text = `
this is a sentance _ this is italic_
`;
  expect(getVersion2(text)).toMatchSnapshot();
});

test("complicated mark regression", () => {
  const text = `
  **Bold re\\-lolo test re\\-check bold**
`;
  expect(getVersion2(text)).toMatchSnapshot();
});

test("parses todo list items", () => {
  const text = `
[ ] todo
[x] done
`;
  expect(getVersion2(text)).toMatchSnapshot();
});

test("parses nested todo list items", () => {
  const text = `
[ ] todo
   [ ] nested
   [ ] deep
`;
  expect(getVersion2(text)).toMatchSnapshot();
});

test("parses double nested todo list items", () => {
  const text = `
[x] checked
   [ ] empty
   [x] checked

[ ] three
`;
  expect(getVersion2(text)).toMatchSnapshot();
});

test("parses todo list items with marks", () => {
  const text = `
 [x] ~~done~~
 [x] more **done**
`;
  expect(getVersion2(text)).toMatchSnapshot();
});

test("headings are not greedy about newlines", () => {
  const text = `
a paragraph

## Heading

another paragraph
`;
  expect(getVersion2(text)).toMatchSnapshot();
});

test("maintains multiple empty paragraphs", () => {
  const text = `
a paragraph


another paragraph
`;
  expect(getVersion2(text)).toMatchSnapshot();
});

test("maintains lots of empty paragraphs", () => {
  const text = `
a paragraph



another paragraph
`;
  expect(getVersion2(text)).toMatchSnapshot();
});

test("maintains heading plus empty paragraphs", () => {
  const text = `
# Heading


another paragraph
`;
  expect(getVersion2(text)).toMatchSnapshot();
});
