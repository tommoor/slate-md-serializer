export function escapeMarkdownChars(text) {
  let result = text

  // First replace all backslashes because we are adding backslashes in this function
  result = result.replace(/([\\])/gi, '\\$1')

  // Periods only happen in ordered lists
  result = result.replace(/^(\s*\w+)\./gi, '$1\\.')

  // Hashtags shouldn't be escaped, but elsewhere should
  result = result.replace(/(#\s)/gi, '\\$1')

  // Catch all escaping for certain characters
  // TODO: situationally escape these characters so we don't overescape
  return result.replace(/([`*{}\[\]()+\-!_>])/gi, '\\$1')
}
