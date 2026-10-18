/** Repair missing word/number spaces in editorial summaries without splitting dice. */
export function readableText(text=''){
 return (text??'').replace(/([\p{L}’])(?=\d)/gu,(match,letter,offset,input)=>letter==='d'&&/\d/.test(input[offset-1]??'')?letter:letter+' ').replace(/(\d)(?=[\p{L}])/gu,(match,number,offset,input)=>input.slice(offset+1).match(/^d\d/)?number:number+' ').replace(/(?<!\d),(?=\S)/g,', ');
}
