/** Order-independent comparison, ignoring only the repository revision counter. */
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
export function sameDefinition(a,b){if(!a||!b)return false;const left=structuredClone(a),right=structuredClone(b);delete left.revision;delete right.revision;return JSON.stringify(stable(left))===JSON.stringify(stable(right));}
