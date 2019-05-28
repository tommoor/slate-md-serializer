export function escapeMarkdownChars(text: string): string {
  let result = text;

  // First replace all backslashes because we are adding backslashes in this function
  result = result.replace(/([\\])/gi, "\\$1");

  // Periods only happen in ordered lists
  result = result.replace(/^(\s*\w+)\./gi, "$1\\.");

  // Hashtags shouldn't be escaped, but elsewhere should
  result = result.replace(/(#\s)/gi, "\\$1");

  // Blockquotes only happen at beginning of line
  result = result.replace(/^(\s*)>/gi, "$1\\>");

  // Hyphens can happen either in tables or as list items (beginning of line)
  // TODO: punting on tables for now
  result = result.replace(/^(\s*)-/gi, "$1\\-");

  // Exclamations only exist in images
  result = result.replace(/!\[(.*)\]\((.*)\)/gi, "\\![$1]($2)");

  // Parenthesis only appear in links and images
  result = result.replace(/\[(.*)\]\((.*)\)/gi, "[$1]\\($2\\)");

  // Catch all escaping for certain characters
  // TODO: situationally escape these characters so we don't overescape
  return result.replace(/([`*{}\[\]+_])/gi, "\\$1");
}
