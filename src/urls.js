// to ensure markdown compatability we need to specifically encode some characters
export function encode(href) {
  return decodeSafe(href)
    .trim()
    .replace(/ /g, "%20")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

export function decode(href) {
  try {
    return decodeURI(href);
  } catch (e) {
    return decodeSafe(href);
  }
}

// convert hanging % characters into percentage encoded %25 as decodeURI cannot
// handle this scenario but users may input 'invalid' urls.
function decodeSafe(uri) {
  const components = uri.split(/(%(?:d0|d1)%.{2})/);
  return components
    .map(component => {
      try {
        return decodeURIComponent(component);
      } catch (e) {
        return component.replace(/%(?!\d+)/g, "%25");
      }
    })
    .join("");
}
