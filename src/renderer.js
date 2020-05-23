import parser from "./parser";
import { Value } from "slate";
import { Record } from "immutable";
import { encode } from "./urls";
import { escapeMarkdownChars } from "./utils";

const String = new Record({
  object: "string",
  text: ""
});

/**
 * Rules to (de)serialize nodes.
 *
 * @type {Object}
 */

let tableHeader = "";
let firstRow = true;
let version;
let previousBlock;
let currentBlock;

const RULES = [
  {
    serialize(obj, children) {
      if (obj.object === "string") {
        return children;
      }
    }
  },
  {
    serialize(obj, children, document) {
      if (obj.object !== "block") return;
      let parent = document.getParent(obj.key);

      if (currentBlock) {
        previousBlock = currentBlock;
      }

      currentBlock = {
        obj,
        children
      };

      switch (obj.type) {
        case "table":
          tableHeader = "";
          firstRow = true;

          // trim removes trailing newline
          return children.trim();
        case "table-cell": {
          switch (obj.getIn(["data", "align"])) {
            case "left":
              tableHeader += "|:--- ";
              break;
            case "center":
              tableHeader += "|:---:";
              break;
            case "right":
              tableHeader += "| ---:";
              break;
            default:
              tableHeader += "| --- ";
          }
          return `| ${children} `;
        }
        case "table-row":
          let output = "";
          if (firstRow) {
            output = `${tableHeader}|\n`;
            tableHeader = "";
            firstRow = false;
          }
          return `${children}|\n${output}`;
        case "paragraph": {
          // version 2 outputs markdown compatible with rich-markdown-editor
          // v10+ – it can be used to migrate documents between v9 -> v10
          if (version === 2) {
            if (children === "") {
              if (
                !previousBlock ||
                previousBlock.obj.type.startsWith("table")
              ) {
                return "";
              }
              if (
                previousBlock &&
                previousBlock.children === "" &&
                previousBlock.obj.type === "paragraph"
              ) {
                return `\\`;
              }
              return `\n\\`;
            }
            return children;
          }

          return children;
        }
        case "code": {
          const language = obj.getIn(["data", "language"]) || "";
          return `\`\`\`${language}\n${children}\n\`\`\``;
        }
        case "code-line":
          return `${children}\n`;
        case "block-quote":
          // Handle multi-line blockquotes
          return children.split("\n").map(text => `> ${text}`).join("\n");
        case "todo-list":
        case "bulleted-list":
        case "ordered-list": {
          // root list
          if (parent === document) {
            return children;
          }

          // nested list
          return `\n${children.replace(/\n+$/gm, "").replace(/^/gm, "   ")}`;
        }
        case "list-item": {
          switch (parent.type) {
            case "ordered-list":
              return `1. ${children}\n`;
            case "todo-list":
              let checked = obj.getIn(["data", "checked"]);
              let box = checked ? "[x]" : "[ ]";

              // version 2 outputs markdown compatible with rich-markdown-editor
              // v10+ – it can be used to migrate documents between v9 -> v10
              let prepend = version === 2 ? "- " : "";
              return `${prepend}${box} ${children}\n`;
            default:
            case "bulleted-list":
              return `* ${children}\n`;
          }
        }
        case "heading1":
          return `# ${children}\n`;
        case "heading2":
          return `\n## ${children}\n`;
        case "heading3":
          return `\n### ${children}\n`;
        case "heading4":
          return `\n#### ${children}\n`;
        case "heading5":
          return `\n##### ${children}\n`;
        case "heading6":
          return `\n###### ${children}\n`;
        case "horizontal-rule":
          return `---`;
        case "image":
          const alt = obj.getIn(["data", "alt"]) || "";
          const src = encode(obj.getIn(["data", "src"]) || "");
          return `![${alt}](${src})`;
      }
    }
  },
  {
    serialize(obj, children) {
      if (obj.type === "hashtag") return children;
    }
  },
  {
    serialize(obj, children) {
      if (obj.type === "link") {
        const href = encode(obj.getIn(["data", "href"]) || "");
        const text = children.trim() || href;
        return href ? `[${text}](${href})` : text;
      }
    }
  },
  {
    serialize(obj, children) {
      if (obj.object !== "mark") return;
      if (!children) return;

      // version 2 outputs markdown compatible with rich-markdown-editor
      // v10+ – it can be used to migrate documents between v9 -> v10
      // trailing spaces must be stripped from marks
      if (version === 2) {
        const match = children.match(/\s+$/);
        const spacesBefore = children.search(/\S|$/);
        const spacesAfter = match ? match[0].length : 0;
        const sB = Array(spacesBefore + 1).join(" ");
        const sA = Array(spacesAfter + 1).join(" ");
        const content = children.trim();

        switch (obj.type) {
          case "bold":
            return `${sB}**${content}**${sA}`;
          case "italic":
            return `${sB}_${content}_${sA}`;
          case "code":
            return `${sB}\`${content}\`${sA}`;
          case "inserted":
            return `${sB}++${content}++${sA}`;
          case "deleted":
            return `${sB}~~${content}~~${sA}`;
          case "underlined":
            return `${sB}__${content}__${sA}`;
        }
        return;
      }

      switch (obj.type) {
        case "bold":
          return `**${children}**`;
        case "italic":
          return `_${children}_`;
        case "code":
          return `\`${children}\``;
        case "inserted":
          return `++${children}++`;
        case "deleted":
          return `~~${children}~~`;
        case "underlined":
          return `__${children}__`;
      }
    }
  }
];

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
    this.rules = [...(options.rules || []), ...RULES];

    this.serializeNode = this.serializeNode.bind(this);
    this.serializeLeaves = this.serializeLeaves.bind(this);
    this.serializeString = this.serializeString.bind(this);
  }

  /**
   * Serialize a `state` object into an HTML string.
   *
   * @param {State} state
   * @param {Object} options
   * @return {String} markdown
   */

  serialize(state, options = {}) {
    // reset state in module context
    version = options.version || 1;
    currentBlock = undefined;
    previousBlock = undefined;

    const { document } = state;
    const elements = document.nodes.map(node =>
      this.serializeNode(node, document)
    );

    let output = elements.join("\n");

    // trim beginning whitespace
    output = output.replace(/^\s+/g, "");

    // fix marks adjacent to marks. This is a quirk in the old editor where a
    // mark crossing \ character boundaries would be stopped and started
    // again. The v2 editor respects Markdown standard and does not interpret
    // these as a mark followed by another mark, and so they must be stripped.
    if (version === 2) {
      return output
        .replace(/\*\*\*\*\\/g, "\\")
        .replace(/\+\+\+\+\\/g, "\\")
        .replace(/~~~~\\/g, "\\")
        .replace(/____\\/g, "\\")
        .replace(/``\\/g, "\\")
        .replace(/__\\/g, "\\");
    }

    return output;
  }

  /**
   * Serialize a `node`.
   *
   * @param {Node} node
   * @return {String}
   */

  serializeNode(node, document) {
    if (node.object == "text") {
      const leaves = node.getLeaves();
      const inCodeBlock = !!document.getClosest(
        node.key,
        n => n.type === "code"
      );

      return leaves.map(leave => {
        const inCodeMark = !!leave.marks.filter(mark => mark.type === "code")
          .size;
        return this.serializeLeaves(leave, !inCodeBlock && !inCodeMark);
      });
    }

    const children = node.nodes
      .map(childNode => {
        const serialized = this.serializeNode(childNode, document);
        return (
          (serialized && serialized.join ? serialized.join("") : serialized) ||
          ""
        );
      })
      .join(
        // Special case for blockquotes, children in blockquotes are separated by new lines
        node.type === "block-quote" ? "\n" : ""
      );

    for (const rule of this.rules) {
      if (!rule.serialize) continue;
      const ret = rule.serialize(node, children, document);
      if (ret) return ret;
    }
  }

  /**
   * Serialize `leaves`.
   *
   * @param {Leave[]} leaves
   * @return {String}
   */

  serializeLeaves(leaves, escape = true) {
    let leavesText = leaves.text;
    if (escape) {
      // escape markdown characters
      leavesText = escapeMarkdownChars(leavesText);
    }
    const string = new String({ text: leavesText });
    const text = this.serializeString(string);

    return leaves.marks.reduce((children, mark) => {
      for (const rule of this.rules) {
        if (!rule.serialize) continue;
        const ret = rule.serialize(mark, children);
        if (ret) return ret;
      }
    }, text);
  }

  /**
   * Serialize a `string`.
   *
   * @param {String} string
   * @return {String}
   */

  serializeString(string) {
    for (const rule of this.rules) {
      if (!rule.serialize) continue;
      const ret = rule.serialize(string, string.text);
      if (ret) return ret;
    }
  }

  /**
   * Deserialize a markdown `string`.
   *
   * @param {String} markdown
   * @return {State} state
   */
  deserialize(markdown) {
    const document = parser.parse(markdown);
    return Value.fromJSON({ document });
  }
}

export default Markdown;
