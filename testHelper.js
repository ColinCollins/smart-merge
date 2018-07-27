const fs = require('fs');
const process = require('child_process');

(function () {
    var launch = fs.readFileSync('.vscode/launch.json',{encoding: 'utf8'});
    var parse = JSON.parse(launch);
    let args = parse.configurations[3].args;
    let fileParse = args[1].match(/([\w-]+)_BASE_([0-9]+)([\.\w]+)/);
    var base = `E:/GitStone/example-cases/assets/${args[0]}/${fileParse[1]}_BASE_${fileParse[2]}${fileParse[3]}`;
    var local = `E:/GitStone/example-cases/assets/${args[0]}/${fileParse[1]}_LOCAl_${fileParse[2]}${fileParse[3]}`
    var remote = `E:/GitStone/example-cases/assets/${args[0]}/${fileParse[1]}_REMOTE_${fileParse[2]}${fileParse[3]}`
    const { cwd } = require('process');
    var child = process.spawn('node', ['PreMerge.js', base, local, remote], {
        cwd: cwd()
    });
    child.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`)
    });

    child.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    child.on('close', (code) => {
        console.log(`child process exited with code: ${code}`);
    });
})();