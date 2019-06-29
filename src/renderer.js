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
        case "paragraph":
          return children;
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
              return `${box} ${children}\n`;
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
   * @return {String} markdown
   */

  serialize(state) {
    const { document } = state;
    const elements = document.nodes.map(node =>
      this.serializeNode(node, document)
    );

    const output = elements.join("\n");

    // trim beginning whitespace
    return output.replace(/^\s+/g, "");
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
