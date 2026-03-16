const fs = require('fs');
const path = require('path');

function fixSvgPaths(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixSvgPaths(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;
      
      // Fix A2 2 0 0116.138 21
      content = content.replace(/A2 2 0 0116\.138 21/g, 'A 2 2 0 0 1 16.138 21');
      // Fix a2 2 0 01-1.995-1.858
      content = content.replace(/a2 2 0 01-1\.995-1\.858/g, 'a 2 2 0 0 1 -1.995 -1.858');
      // Fix a1 1 0 00-1-1
      content = content.replace(/a1 1 0 00-1-1/g, 'a 1 1 0 0 0 -1 -1');
      // Fix a1 1 0 00-1 1
      content = content.replace(/a1 1 0 00-1 1/g, 'a 1 1 0 0 0 -1 1');
      
      // Fix A8.001 8.001 0 004.582 9
      content = content.replace(/A8\.001 8\.001 0 004\.582 9/g, 'A 8.001 8.001 0 0 0 4.582 9');
      // Fix a8.003 8.003 0 01-15.357-2
      content = content.replace(/a8\.003 8\.003 0 01-15\.357-2/g, 'a 8.003 8.003 0 0 1 -15.357 -2');
      
      // Fix a11.955 11.955 0 0112 2.944
      content = content.replace(/A11\.955 11\.955 0 0112 2\.944/g, 'A 11.955 11.955 0 0 1 12 2.944');
      content = content.replace(/a11\.955 11\.955 0 01-8\.618 3\.04/g, 'a 11.955 11.955 0 0 1 -8.618 3.04');
      content = content.replace(/A12\.02 12\.02 0 003 9/g, 'A 12.02 12.02 0 0 0 3 9');
      
      // Fix a4 4 0 110 5.292
      content = content.replace(/a4 4 0 110 5\.292/g, 'a 4 4 0 1 1 0 5.292');
      // Fix a6 6 0 0112 0
      content = content.replace(/a6 6 0 0112 0/g, 'a 6 6 0 0 1 12 0');
      // Fix a6 6 0 01-9-3.5
      content = content.replace(/a6 6 0 01-9-3\.5/g, 'a 6 6 0 0 1 -9 -3.5');
      
      // Fix a2.25 2.25 0 002.25-2.25
      content = content.replace(/a2\.25 2\.25 0 002\.25-2\.25/g, 'a 2.25 2.25 0 0 0 2.25 -2.25');
      // Fix A2.25 2.25 0 0019.5 4.5
      content = content.replace(/A2\.25 2\.25 0 0019\.5 4\.5/g, 'A 2.25 2.25 0 0 0 19.5 4.5');
      // Fix a2.25 2.25 0 00-2.25 2.25
      content = content.replace(/a2\.25 2\.25 0 00-2\.25 2\.25/g, 'a 2.25 2.25 0 0 0 -2.25 2.25');
      // Fix A2.25 2.25 0 004.5 19.5
      content = content.replace(/A2\.25 2\.25 0 004\.5 19\.5/g, 'A 2.25 2.25 0 0 0 4.5 19.5');
      // Fix a1.875 1.875 0 11-3.75 0
      content = content.replace(/a1\.875 1\.875 0 11-3\.75 0/g, 'a 1.875 1.875 0 1 1 -3.75 0');
      // Fix a1.875 1.875 0 013.75 0
      content = content.replace(/a1\.875 1\.875 0 013\.75 0/g, 'a 1.875 1.875 0 0 1 3.75 0');
      // Fix a6.721 6.721 0 01-3.17.789
      content = content.replace(/a6\.721 6\.721 0 01-3\.17\.789/g, 'a 6.721 6.721 0 0 1 -3.17 0.789');
      // Fix a6.721 6.721 0 01-3.168-.789
      content = content.replace(/a6\.721 6\.721 0 01-3\.168-\.789/g, 'a 6.721 6.721 0 0 1 -3.168 -0.789');
      // Fix a3.376 3.376 0 016.338 0
      content = content.replace(/a3\.376 3\.376 0 016\.338 0/g, 'a 3.376 3.376 0 0 1 6.338 0');
      
      // Fix A2.25 2.25 0 003 5.25
      content = content.replace(/A2\.25 2\.25 0 003 5\.25/g, 'A 2.25 2.25 0 0 0 3 5.25');
      // Fix a2.25 2.25 0 003.182 0
      content = content.replace(/a2\.25 2\.25 0 003\.182 0/g, 'a 2.25 2.25 0 0 0 3.182 0');
      // Fix a2.25 2.25 0 000-3.182
      content = content.replace(/a2\.25 2\.25 0 000-3\.182/g, 'a 2.25 2.25 0 0 0 0 -3.182');
      // Fix A2.25 2.25 0 0011.16 3.659
      content = content.replace(/A2\.25 2\.25 0 0011\.16 3\.659/g, 'A 2.25 2.25 0 0 0 11.16 3.659');
      // Fix A2.25 2.25 0 009.568 3
      content = content.replace(/A2\.25 2\.25 0 009\.568 3/g, 'A 2.25 2.25 0 0 0 9.568 3');
      
      // Fix a2 2 0 010 2.828
      content = content.replace(/a2 2 0 010 2\.828/g, 'a 2 2 0 0 1 0 2.828');
      // Fix a2 2 0 01-2.828 0
      content = content.replace(/a2 2 0 01-2\.828 0/g, 'a 2 2 0 0 1 -2.828 0');
      // Fix A1.994 1.994 0 013 12
      content = content.replace(/A1\.994 1\.994 0 013 12/g, 'A 1.994 1.994 0 0 1 3 12');
      // Fix a4 4 0 014-4
      content = content.replace(/a4 4 0 014-4/g, 'a 4 4 0 0 1 4 -4');
      
      // Fix a2 2 0 00-2 2
      content = content.replace(/a2 2 0 00-2 2/g, 'a 2 2 0 0 0 -2 2');
      // Fix a2 2 0 002 2
      content = content.replace(/a2 2 0 002 2/g, 'a 2 2 0 0 0 2 2');
      // Fix a2 2 0 002-2
      content = content.replace(/a2 2 0 002-2/g, 'a 2 2 0 0 0 2 -2');
      // Fix a2 2 0 114 0
      content = content.replace(/a2 2 0 114 0/g, 'a 2 2 0 1 1 4 0');
      // Fix a2 2 0 104 0
      content = content.replace(/a2 2 0 104 0/g, 'a 2 2 0 1 0 4 0');
      // Fix a2 2 0 100-4
      content = content.replace(/a2 2 0 100-4/g, 'a 2 2 0 1 0 0 -4');
      // Fix a2 2 0 000 4
      content = content.replace(/a2 2 0 000 4/g, 'a 2 2 0 0 0 0 4');
      
      // Fix a3.001 3.001 0 00-2.83 2
      content = content.replace(/a3\.001 3\.001 0 00-2\.83 2/g, 'a 3.001 3.001 0 0 0 -2.83 2');
      
      // Fix a2 2 0 100 4
      content = content.replace(/a2 2 0 100 4/g, 'a 2 2 0 1 0 0 4');
      // Fix a2 2 0 000-4
      content = content.replace(/a2 2 0 000-4/g, 'a 2 2 0 0 0 0 -4');
      // Fix a2 2 0 11-4 0
      content = content.replace(/a2 2 0 11-4 0/g, 'a 2 2 0 1 1 -4 0');
      // Fix a2 2 0 014 0
      content = content.replace(/a2 2 0 014 0/g, 'a 2 2 0 0 1 4 0');
      
      // Fix a2 2 0 01-2-2
      content = content.replace(/a2 2 0 01-2-2/g, 'a 2 2 0 0 1 -2 -2');
      // Fix a2 2 0 012-2
      content = content.replace(/a2 2 0 012-2/g, 'a 2 2 0 0 1 2 -2');
      // Fix a1 1 0 01.707.293
      content = content.replace(/a1 1 0 01\.707\.293/g, 'a 1 1 0 0 1 0.707 0.293');
      // Fix a1 1 0 01.293.707
      content = content.replace(/a1 1 0 01\.293\.707/g, 'a 1 1 0 0 1 0.293 0.707');
      // Fix a2 2 0 01-2 2
      content = content.replace(/a2 2 0 01-2 2/g, 'a 2 2 0 0 1 -2 2');
      
      // Fix a3 3 0 003-3
      content = content.replace(/a3 3 0 003-3/g, 'a 3 3 0 0 0 3 -3');
      // Fix a3 3 0 00-3-3
      content = content.replace(/a3 3 0 00-3-3/g, 'a 3 3 0 0 0 -3 -3');
      // Fix a3 3 0 00-3 3
      content = content.replace(/a3 3 0 00-3 3/g, 'a 3 3 0 0 0 -3 3');
      // Fix a3 3 0 003 3
      content = content.replace(/a3 3 0 003 3/g, 'a 3 3 0 0 0 3 3');
      
      // Fix a1.724 1.724 0 002.573 1.066
      content = content.replace(/a1\.724 1\.724 0 002\.573 1\.066/g, 'a 1.724 1.724 0 0 0 2.573 1.066');
      // Fix a1.724 1.724 0 001.065 2.572
      content = content.replace(/a1\.724 1\.724 0 001\.065 2\.572/g, 'a 1.724 1.724 0 0 0 1.065 2.572');
      // Fix a1.724 1.724 0 00-1.066 2.573
      content = content.replace(/a1\.724 1\.724 0 00-1\.066 2\.573/g, 'a 1.724 1.724 0 0 0 -1.066 2.573');
      // Fix a1.724 1.724 0 00-2.572 1.065
      content = content.replace(/a1\.724 1\.724 0 00-2\.572 1\.065/g, 'a 1.724 1.724 0 0 0 -2.572 1.065');
      // Fix a1.724 1.724 0 00-2.573-1.066
      content = content.replace(/a1\.724 1\.724 0 00-2\.573-1\.066/g, 'a 1.724 1.724 0 0 0 -2.573 -1.066');
      // Fix a1.724 1.724 0 00-1.065-2.572
      content = content.replace(/a1\.724 1\.724 0 00-1\.065-2\.572/g, 'a 1.724 1.724 0 0 0 -1.065 -2.572');
      // Fix a1.724 1.724 0 001.066-2.573
      content = content.replace(/a1\.724 1\.724 0 001\.066-2\.573/g, 'a 1.724 1.724 0 0 0 1.066 -2.573');
      // Fix a3 3 0 11-6 0
      content = content.replace(/a3 3 0 11-6 0/g, 'a 3 3 0 1 1 -6 0');
      // Fix a3 3 0 016 0
      content = content.replace(/a3 3 0 016 0/g, 'a 3 3 0 0 1 6 0');
      
      // Fix a9 9 0 11-18 0
      content = content.replace(/a9 9 0 11-18 0/g, 'a 9 9 0 1 1 -18 0');
      // Fix a9 9 0 0118 0
      content = content.replace(/a9 9 0 0118 0/g, 'a 9 9 0 0 1 18 0');
      // Fix a4 4 0 11-8 0
      content = content.replace(/a4 4 0 11-8 0/g, 'a 4 4 0 1 1 -8 0');
      // Fix a4 4 0 018 0
      content = content.replace(/a4 4 0 018 0/g, 'a 4 4 0 0 1 8 0');
      
      // Fix a2 2 0 002-2
      content = content.replace(/a2 2 0 002-2/g, 'a 2 2 0 0 0 2 -2');
      // Fix a2 2 0 00-.586-1.414
      content = content.replace(/a2 2 0 00-\.586-1\.414/g, 'a 2 2 0 0 0 -0.586 -1.414');
      // Fix A2 2 0 0011.586 2
      content = content.replace(/A2 2 0 0011\.586 2/g, 'A 2 2 0 0 0 11.586 2');
      // Fix a2 2 0 00-2 2
      content = content.replace(/a2 2 0 00-2 2/g, 'a 2 2 0 0 0 -2 2');
      // Fix a2 2 0 002 2
      content = content.replace(/a2 2 0 002 2/g, 'a 2 2 0 0 0 2 2');
      
      // Fix a3 3 0 01-3 3
      content = content.replace(/a3 3 0 01-3 3/g, 'a 3 3 0 0 1 -3 3');
      // Fix a3 3 0 01-3-3
      content = content.replace(/a3 3 0 01-3-3/g, 'a 3 3 0 0 1 -3 -3');
      // Fix a3 3 0 013-3
      content = content.replace(/a3 3 0 013-3/g, 'a 3 3 0 0 1 3 -3');
      // Fix a3 3 0 013 3
      content = content.replace(/a3 3 0 013 3/g, 'a 3 3 0 0 1 3 3');
      
      // Fix a7 7 0 11-14 0
      content = content.replace(/a7 7 0 11-14 0/g, 'a 7 7 0 1 1 -14 0');
      // Fix a7 7 0 0114 0
      content = content.replace(/a7 7 0 0114 0/g, 'a 7 7 0 0 1 14 0');
      
      // Fix a2.5 2.5 0 113.536 3.536
      content = content.replace(/a2\.5 2\.5 0 113\.536 3\.536/g, 'a 2.5 2.5 0 1 1 3.536 3.536');
      
      // Fix a2 2 0 00-2-2
      content = content.replace(/a2 2 0 00-2-2/g, 'a 2 2 0 0 0 -2 -2');
      // Fix a2 2 0 00-8 0
      content = content.replace(/a2 2 0 00-8 0/g, 'a 2 2 0 0 0 -8 0');
      // Fix a1 1 0 001 1
      content = content.replace(/a1 1 0 001 1/g, 'a 1 1 0 0 0 1 1');
      // Fix a1 1 0 01-1 1
      content = content.replace(/a1 1 0 01-1 1/g, 'a 1 1 0 0 1 -1 1');
      // Fix a1 1 0 001-1
      content = content.replace(/a1 1 0 001-1/g, 'a 1 1 0 0 0 1 -1');
      // Fix a1 1 0 011-1
      content = content.replace(/a1 1 0 011-1/g, 'a 1 1 0 0 1 1 -1');
      // Fix a4 4 0 00-8 0
      content = content.replace(/a4 4 0 00-8 0/g, 'a 4 4 0 0 0 -8 0');
      // Fix a2 2 0 012.828 0
      content = content.replace(/a2 2 0 012\.828 0/g, 'a 2 2 0 0 1 2.828 0');
      // Fix a2 2 0 01-1.586-1.586
      content = content.replace(/a2 2 0 01-1\.586-1\.586/g, 'a 2 2 0 0 1 -1.586 -1.586');
      // Fix a3 3 0 01-6 0
      content = content.replace(/a3 3 0 01-6 0/g, 'a 3 3 0 0 1 -6 0');
      // Fix a3 3 0 016 0
      content = content.replace(/a3 3 0 016 0/g, 'a 3 3 0 0 1 6 0');
      // Fix a2 2 0 000 4
      content = content.replace(/a2 2 0 000 4/g, 'a 2 2 0 0 0 0 4');
      
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed', fullPath);
      }
    }
  }
}

fixSvgPaths(path.join(__dirname, 'src'));
