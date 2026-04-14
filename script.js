// ─── STATE ───
const images = { antes: [], durante: [], despues: [] };
let currentStep = 1;

// ─── NAVIGATION ───
function goStep(n) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('visible'));
  document.getElementById('step' + n).classList.add('visible');
  document.querySelectorAll('.step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 === n) s.classList.add('active');
    else if (i + 1 < n) s.classList.add('done');
  });
  currentStep = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── IMAGE UPLOAD ───
function addImages(phase, files) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      images[phase].push({ dataUrl: e.target.result, name: file.name, type: file.type });
      renderGrid(phase);
    };
    reader.readAsDataURL(file);
  });
}

function renderGrid(phase) {
  const grid = document.getElementById('grid-' + phase);
  const counter = document.getElementById('count-' + phase);
  grid.innerHTML = '';
  images[phase].forEach((img, i) => {
    const div = document.createElement('div');
    div.className = 'img-thumb';
    div.innerHTML = `
      <img src="${img.dataUrl}" alt="${img.name}" />
      <button class="del-btn" onclick="removeImg('${phase}',${i})">✕</button>
    `;
    grid.appendChild(div);
  });
  counter.textContent = images[phase].length;
}

function removeImg(phase, idx) {
  images[phase].splice(idx, 1);
  renderGrid(phase);
}

// ─── DRAG & DROP ───
function onDragOver(e, phase) {
  e.preventDefault();
  document.getElementById('zone-' + phase).classList.add('dragover');
}
function onDragLeave(phase) {
  document.getElementById('zone-' + phase).classList.remove('dragover');
}
function onDrop(e, phase) {
  e.preventDefault();
  document.getElementById('zone-' + phase).classList.remove('dragover');
  addImages(phase, e.dataTransfer.files);
}

// ─── BUILD PREVIEW ───
function getFormData() {
  return {
    titulo: document.getElementById('titulo').value,
    mes: document.getElementById('mes').value,
    anio: document.getElementById('anio').value,
    municipio: document.getElementById('municipio').value,
    fecha: document.getElementById('fecha').value,
    descripcion: document.getElementById('descripcion').value,
    descAntes: document.getElementById('desc-antes').value,
    descDurante: document.getElementById('desc-durante').value,
    descDespues: document.getElementById('desc-despues').value,
  };
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, mo] = d.split('-');
  const months = ['','enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${parseInt(mo)} de ${months[parseInt(m)]} de ${y}`;
}

function buildImageRows() {
  const allImgs = [];
  ['antes','durante','despues'].forEach(phase => {
    images[phase].forEach(img => allImgs.push({ phase, ...img }));
  });
  const rows = [];
  for (let i = 0; i < allImgs.length; i += 3) {
    rows.push(allImgs.slice(i, i + 3));
  }
  return rows;
}

function buildPreview() {
  const fd = getFormData();
  const container = document.getElementById('preview-container');
  const phaseLabel = { antes: 'ANTES', durante: 'DURANTE', despues: 'DESPUÉS' };
  const allCount = images.antes.length + images.durante.length + images.despues.length;

  const phaseImagesHtml = ['antes', 'durante', 'despues'].map(phase => {
    const imgs = images[phase].map(img => `
      <div class="phase-img-cell">
        <img src="${img.dataUrl}" alt="${phaseLabel[phase]}" />
      </div>
    `).join('');
    return `
      <td>
        <span class="phase-column-label">${phaseLabel[phase]}</span>
        ${imgs || '<div class="phase-empty">No hay imágenes</div>'}
      </td>
    `;
  }).join('');

  container.innerHTML = `
    <div class="doc-preview">
      <h2>${fd.titulo}</h2>
      <div class="doc-meta">
        <strong>Municipio:</strong> ${fd.municipio || ''}<br>
        <strong>Fecha:</strong> ${formatDate(fd.fecha)}
      </div>
      <div class="intro-text">${fd.descripcion}</div>
      <div class="phase-section-preview">
        <div class="phase-title">ANTES:</div>
        <div class="phase-text">${fd.descAntes}</div>
        <div class="phase-title">DURANTE:</div>
        <div class="phase-text">${fd.descDurante}</div>
        <div class="phase-title">DESPUÉS:</div>
        <div class="phase-text">${fd.descDespues}</div>
      </div>
      ${allCount === 0
        ? '<p style="color:#999;text-align:center;padding:20px;">No se han cargado imágenes aún.</p>'
        : `<table class="img-table preview-table"><tr>${phaseImagesHtml}</tr></table>`
      }
    </div>
  `;
}

// ─── GENERATE DOCX ───
async function generateDOCX() {
  const btn = document.getElementById('btn-docx');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generando...';

  try {
    const fd = getFormData();
    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
      ImageRun, AlignmentType, WidthType, BorderStyle, PageBreak
    } = docx;

    async function dataUrlToBuffer(dataUrl) {
      const res = await fetch(dataUrl);
      return await res.arrayBuffer();
    }

    const allImgsByPhase = { antes: [], durante: [], despues: [] };
    for (const phase of ['antes', 'durante', 'despues']) {
      for (const img of images[phase]) {
        const buf = await dataUrlToBuffer(img.dataUrl);
        allImgsByPhase[phase].push({ phase, buf, type: img.type.split('/')[1] || 'jpeg' });
      }
    }

    const border = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
    const borders = { top: border, bottom: border, left: border, right: border };

    const phaseLabel = { antes: 'ANTES', durante: 'DURANTE', despues: 'DESPUÉS' };

    const children = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: fd.titulo, bold: true, size: 28, font: 'Calibri', color: '000000' })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `MES DE ${fd.mes} – ${fd.anio}`, bold: true, size: 26, font: 'Calibri', color: '000000' })]
      }),
      new Paragraph({ children: [] }),
      new Paragraph({ children: [new TextRun({ text: `Municipio: ${fd.municipio}`, size: 22, font: 'Calibri', color: '000000' })] }),
      new Paragraph({ children: [new TextRun({ text: `Fecha: ${formatDate(fd.fecha)}`, size: 22, font: 'Calibri', color: '000000' })] }),
      new Paragraph({ children: [] }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: fd.descripcion, size: 20, font: 'Calibri', color: '000000' })]
      }),
      new Paragraph({ children: [] }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: 'ANTES:', bold: true, size: 22, font: 'Calibri', color: '000000' })]
      }),
      new Paragraph({ children: [new TextRun({ text: `Descripción: ${fd.descAntes}`, size: 20, font: 'Calibri', color: '000000' })] }),
      new Paragraph({ children: [] }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: 'DURANTE:', bold: true, size: 22, font: 'Calibri', color: '000000' })]
      }),
      new Paragraph({ children: [new TextRun({ text: `Descripción: ${fd.descDurante}`, size: 20, font: 'Calibri', color: '000000' })] }),
      new Paragraph({ children: [] }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: 'DESPUÉS:', bold: true, size: 22, font: 'Calibri', color: '000000' })]
      }),
      new Paragraph({ children: [new TextRun({ text: `Descripción: ${fd.descDespues}`, size: 20, font: 'Calibri', color: '000000' })] }),
      new Paragraph({ children: [] }),
    ];

    const tableCells = ['antes', 'durante', 'despues'].map(phase => {
      const cellChildren = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: phaseLabel[phase], bold: true, size: 18, font: 'Calibri', color: '000000' })]
        })
      ];

      const phaseImgs = allImgsByPhase[phase];
      if (phaseImgs.length === 0) {
        cellChildren.push(new Paragraph({ children: [new TextRun({ text: '(Sin imágenes)', size: 18, font: 'Calibri', color: '000000' })] }));
      } else {
        phaseImgs.forEach(img => {
          cellChildren.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({
              data: img.buf,
              transformation: { width: 170, height: 120 },
              type: img.type
            })]
          }));
          cellChildren.push(new Paragraph({ children: [] }));
        });
      }

      return new TableCell({
        borders,
        width: { size: 3000, type: WidthType.DXA },
        margins: { top: 100, bottom: 100, left: 100, right: 100 },
        children: cellChildren
      });
    });

    children.push(new Table({
      width: { size: 9000, type: WidthType.DXA },
      rows: [new TableRow({ children: tableCells })]
    }));

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
          }
        },
        children
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Registro_Luminarias_${fd.mes}_${fd.anio}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Documento Word generado con éxito');
  } catch (e) {
    console.error(e);
    showToast('❌ Error al generar el Word', true);
  }

  btn.disabled = false;
  btn.innerHTML = '<span>⬇️</span> Descargar .docx';
}

// ─── GENERATE PDF ───
async function generatePDF() {
  const btn = document.getElementById('btn-pdf');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generando...';

  try {
    const { jsPDF } = window.jspdf;
    const fd = getFormData();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    const W = 215.9, H = 279.4;
    const margin = 15;
    const cw = W - margin * 2;
    let y = margin;

    const phaseLabel = { antes: 'ANTES', durante: 'DURANTE', despues: 'DESPUÉS' };
    const phaseColors = { antes: [0, 0, 0], durante: [0, 0, 0], despues: [0, 0, 0] };

    function addPage() {
      doc.addPage();
      y = margin;
    }

    function checkSpace(need) {
      if (y + need > H - margin) addPage();
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text(fd.titulo, W / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(11);
    doc.text(`MES DE ${fd.mes} – ${fd.anio}`, W / 2, y, { align: 'center' });
    y += 8;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(margin, y, W - margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Municipio: ${fd.municipio}`, margin, y);
    y += 5.5;
    doc.text(`Fecha: ${formatDate(fd.fecha)}`, margin, y);
    y += 8;

    doc.setFontSize(9);
    const introLines = doc.splitTextToSize(fd.descripcion, cw);
    doc.text(introLines, margin, y);
    y += introLines.length * 4.5 + 6;

    const descMap = { antes: fd.descAntes, durante: fd.descDurante, despues: fd.descDespues };
    for (const phase of ['antes', 'durante', 'despues']) {
      checkSpace(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(phaseLabel[phase] + ':', margin, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      const descLines = doc.splitTextToSize(`Descripción: ${descMap[phase]}`, cw);
      doc.text(descLines, margin, y);
      y += descLines.length * 4.5 + 6;
    }

    const allImgsByPhase = {
      antes: images.antes.map(img => ({ dataUrl: img.dataUrl, type: img.type })),
      durante: images.durante.map(img => ({ dataUrl: img.dataUrl, type: img.type })),
      despues: images.despues.map(img => ({ dataUrl: img.dataUrl, type: img.type })),
    };

    const maxRows = Math.max(allImgsByPhase.antes.length, allImgsByPhase.durante.length, allImgsByPhase.despues.length);
    if (maxRows === 0) {
      checkSpace(12);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('(No se cargaron imágenes)', W / 2, y, { align: 'center' });
      y += 10;
    } else {
      const cols = 3;
      const colW = cw / cols;
      const rowH = 58;
      const imgH = 40;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      for (let col = 0; col < cols; col++) {
        const phase = ['antes', 'durante', 'despues'][col];
        const cx = margin + col * colW;
        doc.text(phaseLabel[phase], cx + 2, y);
      }
      y += 6;

      for (let row = 0; row < maxRows; row++) {
        checkSpace(rowH + 8);
        for (let col = 0; col < cols; col++) {
          const phase = ['antes', 'durante', 'despues'][col];
          const img = allImgsByPhase[phase][row];
          const cx = margin + col * colW;
          const cy = y;
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.3);
          doc.rect(cx + 1, cy, colW - 2, rowH, 'S');

          if (img) {
            const type = img.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            try {
              doc.addImage(img.dataUrl, type, cx + 3, cy + 3, colW - 6, imgH);
            } catch (e) {
              doc.setFillColor(240, 240, 240);
              doc.rect(cx + 3, cy + 3, colW - 6, imgH, 'F');
            }
          }
        }
        y += rowH + 4;
      }
    }

    doc.save(`Registro_Luminarias_${fd.mes}_${fd.anio}.pdf`);
    showToast('✅ PDF generado con éxito');
  } catch (e) {
    console.error(e);
    showToast('❌ Error al generar el PDF', true);
  }

  btn.disabled = false;
  btn.innerHTML = '<span>⬇️</span> Descargar .pdf';
}

// ─── TOAST ───
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}
