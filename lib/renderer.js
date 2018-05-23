"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _parser = require("./parser");

var _parser2 = _interopRequireDefault(_parser);

var _slate = require("slate");

var _immutable = require("immutable");

var _urls = require("./urls");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var String = new _immutable.Record({
  object: "string",
  text: ""
});

/**
 * Rules to (de)serialize nodes.
 *
 * @type {Object}
 */

var tableHeader = "";

var RULES = [{
  serialize: function serialize(obj, children) {
    if (obj.object === "string") {
      return children;
    }
  }
}, {
  serialize: function serialize(obj, children, document) {
    if (obj.object !== "block") return;
    var parent = document.getParent(obj.key);

    // add newline after blocks which must be separated by
    // newlines - i.e. paragraphs, blockquotes and lists.
    var addNewLine = function addNewLine(children) {
      if (document.getNextSibling(obj.key)) {
        return children + "\n\n";
      } else {
        return children;
      }
    };

    switch (obj.type) {
      case "table":
        tableHeader = "";

        // trim removes trailing newline
        return children.trim();
      case "table-head":
        {
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
          return "| " + children + " ";
        }
      case "table-row":
        var output = "";
        if (tableHeader) {
          output = tableHeader + "|\n";
          tableHeader = "";
        }
        return children + "|\n" + output;
      case "table-cell":
        return "| " + children + " ";
      case "paragraph":
        return "" + addNewLine(children);
      case "code-block":
        return "```\n" + children + "\n```";
      case "code":
        return "`\n" + children + "`";
      case "code-line":
        return children + "\n";
      case "block-quote":
        return "" + addNewLine(children.replace(/^/gm, "> "));
      case "todo-list":
      case "bulleted-list":
      case "ordered-list":
        if (parent === document) {
          return children;
        }
        return "\n" + addNewLine(children.replace(/^/gm, "   "));
      case "list-item":
        {
          switch (parent.type) {
            case "ordered-list":
              return "1. " + children + "\n";
            case "todo-list":
              var checked = obj.getIn(["data", "checked"]);
              var box = checked ? "[x]" : "[ ]";
              return box + " " + children + "\n";
            default:
            case "bulleted-list":
              return "* " + children + "\n";
          }
        }
      case "heading1":
        return "\n" + children.replace(/^/gm, "# ") + "\n";
      case "heading2":
        return "\n" + children.replace(/^/gm, "## ") + "\n";
      case "heading3":
        return "\n" + children.replace(/^/gm, "### ") + "\n";
      case "heading4":
        return "\n" + children.replace(/^/gm, "#### ") + "\n";
      case "heading5":
        return "\n" + children.replace(/^/gm, "##### ") + "\n";
      case "heading6":
        return "\n" + children.replace(/^/gm, "###### ") + "\n";
      case "horizontal-rule":
        return "---";
      case "image":
        var alt = obj.getIn(["data", "alt"]);
        var src = (0, _urls.encode)(obj.getIn(["data", "src"]) || "");
        return "![" + alt + "](" + src + ")";
    }
  }
}, {
  serialize: function serialize(obj, children) {
    if (obj.object !== "inline") return;
    switch (obj.type) {
      case "link":
        var href = (0, _urls.encode)(obj.getIn(["data", "href"]) || "");
        return href ? "[" + children.trim() + "](" + href + ")" : children.trim();
    }
  }
},
// Add a new rule that handles marks...
{
  serialize: function serialize(obj, children) {
    if (obj.object !== "mark") return;
    switch (obj.type) {
      case "bold":
        return "**" + children + "**";
      case "italic":
        return "_" + children + "_";
      case "code":
        return "`" + children + "`";
      case "inserted":
        return "++" + children + "++";
      case "deleted":
        return "~~" + children + "~~";
    }
  }
}];

/**
 * Markdown serializer.
 *
 * @type {Markdown}
 */

var Markdown = function () {
  /**
   * Create a new serializer with `rules`.
   *
   * @param {Object} options
   *   @property {Array} rules
   * @return {Markdown} serializer
   */

  function Markdown() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Markdown);

    this.rules = [].concat(_toConsumableArray(options.rules || []), RULES);

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

  _createClass(Markdown, [{
    key: "serialize",
    value: function serialize(state) {
      var _this = this;

      var document = state.document;

      var elements = document.nodes.map(function (node) {
        return _this.serializeNode(node, document);
      });

      var output = elements.join("\n");

      // trim beginning whitespace
      return output.replace(/^\s+/g, "");
    }

    /**
     * Serialize a `node`.
     *
     * @param {Node} node
     * @return {String}
     */

  }, {
    key: "serializeNode",
    value: function serializeNode(node, document) {
      var _this2 = this;

      if (node.object == "text") {
        var leaves = node.getLeaves();
        return leaves.map(this.serializeLeaves);
      }

      var children = node.nodes.map(function (node) {
        return _this2.serializeNode(node, document);
      });

      children = children.flatten().size === 0 ? "" : children.flatten().join("");

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.rules[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var rule = _step.value;

          if (!rule.serialize) continue;
          var ret = rule.serialize(node, children, document);
          if (ret) return ret;
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    }

    /**
     * Serialize `leaves`.
     *
     * @param {Leave[]} leaves
     * @return {String}
     */

  }, {
    key: "serializeLeaves",
    value: function serializeLeaves(leaves) {
      var _this3 = this;

      var string = new String({ text: leaves.text });
      var text = this.serializeString(string);

      return leaves.marks.reduce(function (children, mark) {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = _this3.rules[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var rule = _step2.value;

            if (!rule.serialize) continue;
            var ret = rule.serialize(mark, children);
            if (ret) return ret;
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      }, text);
    }

    /**
     * Serialize a `string`.
     *
     * @param {String} string
     * @return {String}
     */

  }, {
    key: "serializeString",
    value: function serializeString(string) {
      // escape markdown characters
      var text = string.text.replace(/([\\`*{}\[\]()#+\-.!_>])/gi, "\\$1");

      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = this.rules[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var rule = _step3.value;

          if (!rule.serialize) continue;
          var ret = rule.serialize(string, text);
          if (ret) return ret;
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }
    }

    /**
     * Deserialize a markdown `string`.
     *
     * @param {String} markdown
     * @return {State} state
     */

  }, {
    key: "deserialize",
    value: function deserialize(markdown) {
      var document = _parser2.default.parse(markdown);
      var state = _slate.Value.fromJSON({ document: document });
      return state;
    }
  }]);

  return Markdown;
}();

exports.default = Markdown;