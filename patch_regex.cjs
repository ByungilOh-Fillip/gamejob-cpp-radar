const fs = require('fs');
let code = fs.readFileSync('src/crawler.js', 'utf8');

const target1 = `const ta = /ta|technical\\s*artist|테크니컬\\s*아티스트/.test(t);`;
const replace1 = `const ta = /\\bta\\b|technical\\s*artist|테크니컬\\s*아티스트/.test(t);`;

const target2 = `const taRegex = /TA|Technical\\s*Artist|테크니컬\\s*아티스트|블랜더|블렌더|blender|3ds?\\s*max|마야|maya|서브스턴스|substance|페인터|painter|모델링|modeling|언리얼|Unreal|유니티|Unity/i;`;
const replace2 = `const taRegex = /\\bTA\\b|Technical\\s*Artist|테크니컬\\s*아티스트|블랜더|블렌더|blender|3ds?\\s*max|마야|maya|서브스턴스|substance|페인터|painter|모델링|modeling|언리얼|Unreal|유니티|Unity/i;`;

code = code.replace(target1, replace1);
code = code.replace(target2, replace2);

fs.writeFileSync('src/crawler.js', code);
console.log("Patched regex");
