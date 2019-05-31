import { decode } from "./urls";
import generateHashtagRegex from "hashtag-regex";

/**
 * Ported from:
 *   https://github.com/chjj/marked/blob/49b7eaca/lib/marked.js
 * TODO:
 *   Use ES6 classes
 *   Add flow annotations
 */

// we need to convert the regex supplied by the dependency to have the
// entire hashtag contents within a capture group and begin with newline
const hashtag = new RegExp(
  generateHashtagRegex().source.replace(/^/, "^(").replace(/$/, ")")
);

const EMPTY_PARAGRAPH_NODES = [
  {
    object: "text",
    text: ""
  }
];

const hasOwnProperty = Object.prototype.hasOwnProperty;

const assign =
  Object.assign ||
  function(obj) {
    var i = 1;
    for (; i < arguments.length; i++) {
      var target = arguments[i];
      for (var key in target) {
        if (hasOwnProperty.call(target, key)) {
          obj[key] = target[key];
        }
      }
    }
    return obj;
  };

const flatten = function(ary) {
  return [].concat.apply([], ary);
};

const noop = function() {};
noop.exec = noop;

var defaults = {
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  smartLists: true,
  silent: false,
  renderer: new Renderer()
};

/**
 * Block-Level Grammar
 */

var block = {
  newline: /^\n+/,
  code: /^( {4}[^\n]+\n*)+/,
  fences: noop,
  hr: /^( *[-*_]){3,} *(?:\n|$)/,
  heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n|$)/,
  nptable: noop,
  blockquote: /^( *>[^\n]+(\n(?!def)[^\n])*(?:\n|$))+/,
  list: /^( *)(bull) [\s\S]+?(?:hr|def|\n(?! )(?!\1bull )\n|\s*$)/,
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n|$)/,
  paragraph: /^((?:[^\n]+(?!hr|heading|blockquote|def))+)(?:\n|$)/,
  text: /^[^\n]+/
};

block.bullet = /(?:[*+-]|\d+\.|\[[x\s]\])/;
block.item = /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/;
block.item = replace(block.item, "gm")(/bull/g, block.bullet)();

block.list = replace(block.list)(/bull/g, block.bullet)(
  "hr",
  "\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))"
)("def", "\\n+(?=" + block.def.source + ")")();

block.blockquote = replace(block.blockquote)("def", block.def)();

block.paragraph = replace(block.paragraph)("hr", block.hr)(
  "heading",
  block.heading
)("blockquote", block.blockquote)("def", block.def)();

/**
 * Normal Block Grammar
 */

block.normal = assign({}, block);

/**
 * GFM Block Grammar
 */

block.gfm = assign({}, block.normal, {
  fences: /^ *(`{3,}|~{3,})[ \.]*(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n|$)/,
  paragraph: /^/,
  heading: /^ *(#{1,6}) +([^\n]+?) *#* *(?:\n{1,2}|$)/
});

block.gfm.paragraph = replace(block.paragraph)(
  "(?!",
  "(?!" +
    block.gfm.fences.source.replace("\\1", "\\2") +
    "|" +
    block.list.source.replace("\\1", "\\3") +
    "|"
)();

/**
 * GFM + Tables Block Grammar
 */

block.tables = assign({}, block.gfm, {
  nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)/,
  table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)/
});

/**
 * Block Lexer
 */

function Lexer(options) {
  this.tokens = [];
  this.tokens.links = {};
  this.options = assign({}, options || defaults);
  this.rules = block.normal;

  if (this.options.gfm) {
    if (this.options.tables) {
      this.rules = block.tables;
    } else {
      this.rules = block.gfm;
    }
  }
}

/**
 * Expose Block Rules
 */

Lexer.rules = block;

/**
 * Static Lex Method
 */

Lexer.parse = function(src, options) {
  var lexer = new Lexer(options);
  return lexer.parse(src);
};

/**
 * Preprocessing
 */

Lexer.prototype.parse = function(src) {
  src = src
    .replace(/\r\n|\r/g, "\n")
    .replace(/\t/g, "    ")
    .replace(/\u00a0/g, " ")
    .replace(/\u2424/g, "\n");

  return this.token(src, true);
};

/**
 * Lexing
 */

Lexer.prototype.token = function(src, top, bq) {
  var next;
  var loose;
  var cap;
  var bull;
  var b;
  var item;
  var space;
  var i;
  var l;

  src = src.replace(/^ +$/gm, "");
  src = src.replace(/^\n/, "");

  while (src) {
    // newline
    if ((cap = this.rules.newline.exec(src))) {
      src = src.substring(cap[0].length);
      const newlines = cap[0].length;

      if (top) {
        for (let i = 0; i < newlines; i++) {
          this.tokens.push({
            type: "paragraph",
            text: ""
          });
        }
      }
    }

    // code
    if ((cap = this.rules.code.exec(src))) {
      src = src.substring(cap[0].length);
      cap = cap[0].replace(/^ {4}/gm, "");
      this.tokens.push({
        type: "code",
        text: !this.options.pedantic ? cap.replace(/\n+$/, "") : cap
      });
      continue;
    }

    // fences (gfm)
    if ((cap = this.rules.fences.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: "code",
        lang: cap[2],
        text: cap[3]
      });
      continue;
    }

    // heading
    if ((cap = this.rules.heading.exec(src))) {
      src = src.substring(cap[0].length);

      const last = this.tokens[this.tokens.length - 1];
      if (last && last.type === "paragraph" && last.text === "") {
        this.tokens.splice(-1, 1);
      }

      this.tokens.push({
        type: "heading",
        depth: cap[1].length,
        text: cap[2]
      });
      continue;
    }

    // table no leading pipe (gfm)
    if (top && (cap = this.rules.nptable.exec(src))) {
      src = src.substring(cap[0].length);

      item = {
        type: "table",
        header: cap[1].replace(/^ *| *\| *$/g, "").split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, "").split(/ *\| */),
        cells: cap[3].replace(/\n$/, "").split("\n")
      };

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = "right";
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = "center";
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = "left";
        } else {
          item.align[i] = null;
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i].split(/ *\| */);
      }

      this.tokens.push(item);

      continue;
    }

    // hr
    if ((cap = this.rules.hr.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: "hr"
      });
      continue;
    }

    // blockquote
    if ((cap = this.rules.blockquote.exec(src))) {
      src = src.substring(cap[0].length);

      this.tokens.push({
        type: "blockquote_start"
      });

      cap = cap[0].replace(/^ *> ?/gm, "");

      // Pass `top` to keep the current
      // "toplevel" state. This is exactly
      // how markdown.pl works.
      this.token(cap, top, true);

      this.tokens.push({
        type: "blockquote_end"
      });

      continue;
    }

    // list
    if ((cap = this.rules.list.exec(src))) {
      src = src.substring(cap[0].length);
      bull = cap[2];
      let ordered = bull.length > 1;
      let todo = bull[0] === "[";

      this.tokens.push({
        type: "list_start",
        style: todo ? "todo" : ordered ? "ordered" : "bulleted"
      });

      // Get each top-level item.
      cap = cap[0].match(this.rules.item);

      next = false;
      l = cap.length;
      i = 0;

      for (; i < l; i++) {
        item = cap[i];

        // Remove the list item's bullet
        // so it is seen as the next token.
        let checked = todo ? !!item.match(/^ *(\[x\])/) : undefined;
        space = item.length;
        item = item.replace(/^ *([*+-]|\d+\.|\[[x\s]\]) +/, "");

        // Outdent whatever the
        // list item contains. Hacky.
        if (~item.indexOf("\n ")) {
          space -= item.length;
          item = !this.options.pedantic
            ? item.replace(new RegExp("^ {1," + space + "}", "gm"), "")
            : item.replace(/^ {1,4}/gm, "");
        }

        // Determine whether the next list item belongs here.
        // Backpedal if it does not belong in this list.
        if (this.options.smartLists && i !== l - 1) {
          b = block.bullet.exec(cap[i + 1])[0];
          if (bull !== b && !(bull.length > 1 && b.length > 1)) {
            src = cap.slice(i + 1).join("\n") + src;
            i = l - 1;
          }
        }

        // Determine whether item is loose or not.
        // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
        // for discount behavior.
        loose = next || /\n\n(?!\s*$)/.test(item);
        if (i !== l - 1) {
          next = item.charAt(item.length - 1) === "\n";
          if (!loose) {
            loose = next;
          }
        }

        this.tokens.push({
          checked,
          type: loose ? "loose_item_start" : "list_item_start"
        });

        // Recurse.
        this.token(item, false, bq);

        this.tokens.push({
          type: "list_item_end"
        });
      }

      this.tokens.push({
        type: "list_end"
      });

      continue;
    }

    // def
    if (!bq && top && (cap = this.rules.def.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.links[cap[1].toLowerCase()] = {
        href: cap[2],
        title: cap[3]
      };
      continue;
    }

    // table (gfm)
    if (top && (cap = this.rules.table.exec(src))) {
      src = src.substring(cap[0].length);

      item = {
        type: "table",
        header: cap[1].replace(/^ *| *\| *$/g, "").split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, "").split(/ *\| */),
        cells: cap[3].replace(/(?: *\| *)?\n$/, "").split("\n")
      };

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = "right";
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = "center";
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = "left";
        } else {
          item.align[i] = null;
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i]
          .replace(/^ *\| *| *\| *$/g, "")
          .split(/ *\| */);
      }

      this.tokens.push(item);

      continue;
    }

    // top-level paragraph
    if (top && (cap = this.rules.paragraph.exec(src))) {
      src = src.substring(cap[0].length);
      const endsWithNewline = cap[1].charAt(cap[1].length - 1) === "\n";
      this.tokens.push({
        type: "paragraph",
        text: endsWithNewline ? cap[1].slice(0, -1) : cap[1]
      });
      if (endsWithNewline) {
        this.tokens.push({
          type: "paragraph",
          text: ""
        });
      }
      continue;
    }

    // text
    if ((cap = this.rules.text.exec(src))) {
      // Top-level should never reach here.
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: "text",
        text: cap[0]
      });
      continue;
    }

    if (src) {
      throw new Error("Infinite loop on byte: " + src.charCodeAt(0));
    }
  }

  return this.tokens;
};

/**
 * Inline-Level Grammar
 */

var inline = {
  escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
  link: /^!?\[(inside)\]\(href\)/,
  hashtag,
  reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
  nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
  strong: /^\*\*([\s\S]+?)\*\*(?!\*)/,
  underlined: /^__([\s\S]+?)__(?!_)/,
  em: /^\b_((?:__|[\s\S])+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
  code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
  br: /^ {2,}\n(?!\s*$)/,
  del: noop,
  ins: noop,
  text: /^[\s\S]+?(?=[\\<!\[_*#`]| {2,}\n|$)/
};

inline._inside = /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/;
inline._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;

inline.link = replace(inline.link)("inside", inline._inside)(
  "href",
  inline._href
)();

inline.reflink = replace(inline.reflink)("inside", inline._inside)();

/**
 * Normal Inline Grammar
 */

inline.normal = assign({}, inline);

/**
 * Pedantic Inline Grammar
 */

inline.pedantic = assign({}, inline.normal, {
  strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
  em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
});

/**
 * GFM Inline Grammar
 */

inline.gfm = assign({}, inline.normal, {
  escape: replace(inline.escape)("])", "~|])")(),
  del: /^~~(?=\S)([\s\S]*?\S)~~/,
  ins: /^\+\+(?=\S)([\s\S]*?\S)\+\+/,
  text: replace(inline.text)("]|", "~+]|")()
});

/**
 * GFM + Line Breaks Inline Grammar
 */

inline.breaks = assign({}, inline.gfm, {
  br: replace(inline.br)("{2,}", "*")(),
  text: replace(inline.gfm.text)("{2,}", "*")()
});

/**
 * Inline Lexer & Compiler
 */

function InlineLexer(links, options) {
  this.options = assign({}, options || defaults);
  this.links = links;
  this.rules = inline.normal;
  this.renderer = this.options.renderer || new Renderer();
  this.renderer.options = this.options;

  if (!this.links) {
    throw new Error("Tokens array requires a `links` property.");
  }

  if (this.options.gfm) {
    if (this.options.breaks) {
      this.rules = inline.breaks;
    } else {
      this.rules = inline.gfm;
    }
  } else if (this.options.pedantic) {
    this.rules = inline.pedantic;
  }
}

/**
 * Expose Inline Rules
 */

InlineLexer.rules = inline;

/**
 * Static Lexing/Compiling Method
 */

InlineLexer.parse = function(src, links, options) {
  var inline = new InlineLexer(links, options);
  return inline.parse(src);
};

/**
 * Lexing/Compiling
 */

InlineLexer.prototype.parse = function(src) {
  var out = [];
  var link;
  var cap;

  while (src) {
    // escape
    if ((cap = this.rules.escape.exec(src))) {
      src = src.substring(cap[0].length);
      out.push({
        object: "text",
        text: cap[1]
      });
      continue;
    }

    // link
    if ((cap = this.rules.link.exec(src))) {
      src = src.substring(cap[0].length);
      out.push(this.outputLink(cap, { href: cap[2], title: cap[3] }));
      continue;
    }

    // hashtag
    if ((cap = this.rules.hashtag.exec(src))) {
      src = src.substring(cap[0].length);
      out.push(this.renderer.hashtag(cap[1]));
      continue;
    }

    // reflink, nolink
    // TODO
    if (
      (cap = this.rules.reflink.exec(src)) ||
      (cap = this.rules.nolink.exec(src))
    ) {
      src = src.substring(cap[0].length);
      link = (cap[2] || cap[1]).replace(/\s+/g, " ");
      link = this.links[link.toLowerCase()];
      if (!link || !link.href) {
        out.push({
          object: "text",
          text: cap[0].charAt(0)
        });
        src = cap[0].substring(1) + src;
        continue;
      }
      out.push(this.outputLink(cap, link));
      continue;
    }

    // underlined
    if ((cap = this.rules.underlined.exec(src))) {
      src = src.substring(cap[0].length);
      out.push(this.renderer.underlined(this.parse(cap[2] || cap[1])));
      continue;
    }

    // strong
    if ((cap = this.rules.strong.exec(src))) {
      src = src.substring(cap[0].length);
      out.push(this.renderer.strong(this.parse(cap[2] || cap[1])));
      continue;
    }

    // em
    if ((cap = this.rules.em.exec(src))) {
      src = src.substring(cap[0].length);
      out.push(this.renderer.em(this.parse(cap[2] || cap[1])));
      continue;
    }

    // code
    if ((cap = this.rules.code.exec(src))) {
      src = src.substring(cap[0].length);
      out.push(this.renderer.codespan(cap[2]));
      continue;
    }

    // br
    if ((cap = this.rules.br.exec(src))) {
      src = src.substring(cap[0].length);
      out.push(this.renderer.br());
      continue;
    }

    // del (gfm)
    if ((cap = this.rules.del.exec(src))) {
      src = src.substring(cap[0].length);
      out.push(this.renderer.del(this.parse(cap[1])));
      continue;
    }

    // ins (gfm extended)
    if ((cap = this.rules.ins.exec(src))) {
      src = src.substring(cap[0].length);
      out.push(this.renderer.ins(this.parse(cap[1])));
      continue;
    }

    // text
    if ((cap = this.rules.text.exec(src))) {
      src = src.substring(cap[0].length);
      out.push(this.renderer.text(cap[0]));
      continue;
    }

    if (src) {
      throw new Error("Infinite loop on byte: " + src.charCodeAt(0));
    }
  }

  return out;
};

/**
 * Compile Link
 */

InlineLexer.prototype.outputLink = function(cap, link) {
  var href = link.href;
  var title = link.title;

  return cap[0].charAt(0) !== "!"
    ? this.renderer.link(href, title, this.parse(cap[1]))
    : this.renderer.image(href, title, cap[1]);
};

/**
 * Renderer
 */

function Renderer(options) {
  this.options = options || {};
}

Renderer.prototype.groupTextInLeaves = function(childNode) {
  let node = flatten(childNode);
  let previousMarks
  const output = node.reduce((acc, current) => {
    if (current.text) {
      let currentMarks = (current.marks || []).map(({type}) => type).join('');
      let previous = acc.slice(-1)[0];
      let mergeWithPrevious = previous &&
        previous.object === 'text' &&
        currentMarks === previousMarks;

      if (mergeWithPrevious) {
        previous.text += current.text;
      } else {
        previousMarks = currentMarks;

        acc.push(
          assign({}, current, {object: "text"})
        );
      }

      return acc;
    } else if (current instanceof Array) {
      return acc.concat(this.groupTextInLeaves(current));
    } else {
      acc.push(current);
      return acc;
    }
  }, []);

  if (!output.length) return EMPTY_PARAGRAPH_NODES;
  return output;
};

Renderer.prototype.code = function(childNode, language) {
  var data = {};

  if (language) {
    data.language = language;
  }

  return {
    object: "block",
    type: "code",
    data,
    nodes: this.groupTextInLeaves(childNode)
  };
};

Renderer.prototype.blockquote = function(childNode) {
  return {
    object: "block",
    type: "block-quote",
    nodes: this.groupTextInLeaves(childNode)
  };
};

Renderer.prototype.heading = function(childNode, level) {
  return {
    object: "block",
    type: "heading" + level,
    nodes: this.groupTextInLeaves(childNode)
  };
};

Renderer.prototype.hr = function() {
  return {
    object: "block",
    type: "horizontal-rule",
    isVoid: true,
    nodes: EMPTY_PARAGRAPH_NODES
  };
};

Renderer.prototype.list = function(childNode, style) {
  return {
    object: "block",
    type: `${style}-list`,
    nodes: childNode
  };
};

Renderer.prototype.listitem = function(childNode, flags = {}) {
  let data;
  if (flags.checked !== undefined) {
    data = { checked: flags.checked };
  }

  return {
    object: "block",
    type: "list-item",
    data,
    nodes: this.groupTextInLeaves(childNode)
  };
};

Renderer.prototype.paragraph = function(childNode) {
  return {
    object: "block",
    type: "paragraph",
    nodes: this.groupTextInLeaves(childNode)
  };
};

Renderer.prototype.table = function(childNode) {
  return {
    object: "block",
    type: "table",
    nodes: childNode
  };
};

Renderer.prototype.tablerow = function(childNode) {
  return {
    object: "block",
    type: "table-row",
    nodes: childNode
  };
};

Renderer.prototype.tablecell = function(childNode, flags) {
  const align = flags.align;

  return {
    object: "block",
    data: { align },
    type: flags.header ? "table-head" : "table-cell",
    nodes: this.groupTextInLeaves(childNode)
  };
};

// span level renderer
Renderer.prototype.underlined = function(childNode) {
  return childNode.map(node => {
    if (node.marks) {
      node.marks.push({ type: "underlined" });
    } else {
      node.marks = [{ type: "underlined" }];
    }
    return node;
  });
};

Renderer.prototype.strong = function(childNode) {
  return childNode.map(node => {
    if (node.marks) {
      node.marks.push({ type: "bold" });
    } else {
      node.marks = [{ type: "bold" }];
    }
    return node;
  });
};

Renderer.prototype.em = function(childNode) {
  return childNode.map(node => {
    if (node.marks) {
      node.marks.push({ type: "italic" });
    } else {
      node.marks = [{ type: "italic" }];
    }
    return node;
  });
};

Renderer.prototype.codespan = function(text) {
  return {
    text,
    marks: [{ type: "code" }]
  };
};

Renderer.prototype.br = function() {
  return {
    text: " "
  };
};

Renderer.prototype.del = function(childNode) {
  return childNode.map(node => {
    if (node.marks) {
      node.marks.push({ type: "deleted" });
    } else {
      node.marks = [{ type: "deleted" }];
    }
    return node;
  });
};

Renderer.prototype.ins = function(childNode) {
  return childNode.map(node => {
    if (node.marks) {
      node.marks.push({ type: "inserted" });
    } else {
      node.marks = [{ type: "inserted" }];
    }
    return node;
  });
};

Renderer.prototype.hashtag = function(childNode) {
  return {
    object: "inline",
    type: "hashtag",
    nodes: [
      {
        object: "text",
        text: childNode
      }
    ]
  };
};

Renderer.prototype.link = function(href, title, childNode) {
  var data = {
    href: decode(href)
  };
  if (title) {
    data.title = title;
  }
  return {
    object: "inline",
    type: "link",
    nodes: this.groupTextInLeaves(childNode),
    data: data
  };
};

Renderer.prototype.image = function(href, title, alt) {
  var data = {
    src: decode(href)
  };

  if (title) {
    data.title = title;
  }
  if (alt) {
    data.alt = alt;
  }

  return {
    object: "block",
    type: "image",
    nodes: EMPTY_PARAGRAPH_NODES,
    isVoid: true,
    data: data
  };
};

Renderer.prototype.text = function(childNode) {
  return {
    text: childNode
  };
};

/**
 * Parsing & Compiling
 */

function Parser(options) {
  this.tokens = [];
  this.token = null;
  this.options = assign({}, options || defaults);
  this.options.renderer = this.options.renderer || new Renderer();
  this.renderer = this.options.renderer;
  this.renderer.options = this.options;
}

/**
 * Static Parse Method
 */

Parser.parse = function(src, options, renderer) {
  var parser = new Parser(options, renderer);
  return parser.parse(src);
};

/**
 * Parse Loop
 */

Parser.prototype.parse = function(src) {
  this.inline = new InlineLexer(src.links, this.options, this.renderer);
  this.tokens = src.slice().reverse();

  var out = [];
  while (this.next()) {
    out.push(this.tok());
  }

  return out;
};

/**
 * Next Token
 */

Parser.prototype.next = function() {
  return (this.token = this.tokens.pop());
};

/**
 * Preview Next Token
 */

Parser.prototype.peek = function() {
  return this.tokens[this.tokens.length - 1] || 0;
};

/**
 * Parse Text Tokens
 */

Parser.prototype.parseText = function() {
  var body = this.token.text;

  while (this.peek().type === "text") {
    body += "\n" + this.next().text;
  }

  return this.inline.parse(body);
};

/**
 * Parse Current Token
 */

Parser.prototype.tok = function() {
  switch (this.token.type) {
    case "space": {
      return {
        object: "text",
        text: ""
      };
    }
    case "hr": {
      return this.renderer.hr();
    }
    case "heading": {
      return this.renderer.heading(
        this.inline.parse(this.token.text),
        this.token.depth
      );
    }
    case "code": {
      // Text inside of code blocks should not be parsed for marks
      return this.renderer.code(
        [
          {
            object: "text",
            text: this.token.text
          }
        ],
        this.token.lang
      );
    }
    case "table": {
      let body = [];
      let i, row, flags, j;

      // header
      let cells = [];
      for (i = 0; i < this.token.header.length; i++) {
        flags = { header: true, align: this.token.align[i] };
        cells.push(
          this.renderer.tablecell(this.inline.parse(this.token.header[i]), {
            header: true,
            align: this.token.align[i]
          })
        );
      }
      body.push(this.renderer.tablerow(cells));

      for (i = 0; i < this.token.cells.length; i++) {
        row = this.token.cells[i];

        let cells = [];
        for (j = 0; j < row.length; j++) {
          cells.push(
            this.renderer.tablecell(this.inline.parse(row[j]), {
              header: false,
              align: this.token.align[j]
            })
          );
        }

        body.push(this.renderer.tablerow(cells));
      }
      return this.renderer.table(body);
    }
    case "blockquote_start": {
      let body = [];

      while (this.next().type !== "blockquote_end") {
        body.push(
          this.token.type === "text"
            ? this.renderer.paragraph(this.inline.parse(this.token.text))
            : this.tok()
        );
      }
      return this.renderer.blockquote(body);
    }
    case "list_start": {
      let body = [];
      let style = this.token.style;

      while (this.next().type !== "list_end") {
        body.push(this.tok());
      }

      return this.renderer.list(body, style);
    }
    case "loose_item_start":
    case "list_item_start": {
      let body = [];
      let flags = { checked: this.token.checked };

      while (this.next().type !== "list_item_end") {
        body.push(
          this.token.type === "text"
            ? this.inline.parse(this.token.text)
            : this.tok()
        );
      }

      return this.renderer.listitem(body, flags);
    }
    case "paragraph": {
      return this.renderer.paragraph(this.inline.parse(this.token.text));
    }
    case "text": {
      return this.renderer.text(this.parseText());
    }
  }
};

/**
 * Helpers
 */

function replace(regex, options) {
  regex = regex.source;
  options = options || "";
  return function self(name, val) {
    if (!name) {
      return new RegExp(regex, options);
    }
    val = val.source || val;
    val = val.replace(/(^|[^\[])\^/g, "$1");
    regex = regex.replace(name, val);
    return self;
  };
}

const MarkdownParser = {
  parse(src, options) {
    options = assign({}, defaults, options);
    let fragment;

    try {
      fragment = Parser.parse(Lexer.parse(src, options), options);

      if (!fragment.length) {
        fragment = [
          {
            object: "block",
            type: "paragraph",
            isVoid: false,
            data: {},
            nodes: EMPTY_PARAGRAPH_NODES
          }
        ];
      }
    } catch (err) {
      if (options.silent) {
        fragment = [
          {
            object: "block",
            type: "paragraph",
            isVoid: false,
            data: {},
            nodes: [
              {
                object: "text",
                text: "An error occured:"
              },
              {
                object: "text",
                text: e.message
              }
            ]
          }
        ];
      } else {
        throw err;
      }
    }

    return { nodes: fragment };
  }
};

export default MarkdownParser;
