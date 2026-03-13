const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = require('docx');

const mdPath = 'C:\\Users\\aless\\.gemini\\antigravity\\brain\\ff2eef75-2c1c-4473-b856-68eacafe10e3\\apresentacao_projeto_diretoria.md';
const outputPath = 'c:\\Users\\aless\\.antigravity\\Torneio de Padel\\Apresentacao_Diretoria_Padel.docx';

const content = fs.readFileSync(mdPath, 'utf8');
const lines = content.split('\n');
const children = [];

lines.forEach(line => {
    line = line.trim();
    if (!line) return;

    if (line.startsWith('# ')) {
        children.push(new Paragraph({
            text: line.replace('# ', ''),
            heading: HeadingLevel.HEADING_1,
        }));
    } else if (line.startsWith('### ')) {
        children.push(new Paragraph({
            text: line.replace('### ', ''),
            heading: HeadingLevel.HEADING_3,
        }));
    } else if (line.startsWith('## ')) {
        children.push(new Paragraph({
            text: line.replace('## ', ''),
            heading: HeadingLevel.HEADING_2,
        }));
    } else if (line.startsWith('![')) {
        const match = line.match(/!\[.*\]\((.*)\)/);
        if (match) {
            let imgUrl = match[1].replace('file:///', '');
            if (process.platform === 'win32') {
                imgUrl = imgUrl.replace(/\//g, '\\');
            }
            if (fs.existsSync(imgUrl)) {
                children.push(new Paragraph({
                    children: [
                        new ImageRun({
                            data: fs.readFileSync(imgUrl),
                            transformation: {
                                width: 500,
                                height: 300,
                            },
                        }),
                    ],
                }));
            }
        }
    } else if (line.startsWith('* ')) {
        children.push(new Paragraph({
            text: line.replace('* ', '• '),
            bullet: { level: 0 }
        }));
    } else {
        children.push(new Paragraph({
            children: [new TextRun(line)],
        }));
    }
});

const doc = new Document({
    sections: [{
        properties: {},
        children: children
    }]
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync(outputPath, buffer);
    console.log('DOCX created successfully at: ' + outputPath);
});
