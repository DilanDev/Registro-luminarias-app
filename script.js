// ─── STATE ───
const images = { antes: [], durante: [], despues: [] };
const phaseLabel = { antes: 'ANTES', durante: 'DURANTE', despues: 'DESPUÉS' };
let currentStep = 1;
const STEP_LABELS = ['', 'Información', 'Fotografías', 'Vista Previa', 'Exportar'];

// ─── NAVIGATION ───
function goStep(n) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('visible'));
  document.getElementById('step' + n).classList.add('visible');
  document.querySelectorAll('.step-dot').forEach((d, i) => {
    d.classList.remove('active', 'done');
    if (i + 1 === n) d.classList.add('active');
    else if (i + 1 < n) d.classList.add('done');
  });
  document.getElementById('step-label-text').textContent = STEP_LABELS[n];
  currentStep = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── IMAGE UPLOAD ───
function addImages(phase, files) {
  const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
  if (imageFiles.length === 0) return;

  Promise.all(imageFiles.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve({ dataUrl: e.target.result, name: file.name, type: file.type });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })))
    .then(loadedImages => {
      images[phase].push(...loadedImages);
      renderGrid(phase);
    })
    .catch(err => {
      console.error('Error loading images:', err);
      showToast('❌ Error cargando imágenes', true);
    });
}

function renderGrid(phase) {
  const grid = document.getElementById('grid-' + phase);
  const badge = document.getElementById('count-' + phase);
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
  badge.textContent = images[phase].length;
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

// ─── FORM DATA ───
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
  const parts = d.split('-');
  const y = parts[0], m = parts[1], mo = parts[2];
  const months = ['','enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${parseInt(mo)} de ${months[parseInt(m)]} de ${y}`;
}

// ─── BUILD PREVIEW ───
function buildPreview() {
  const fd = getFormData();
  const container = document.getElementById('preview-container');

  const phaseColumns = ['antes', 'durante', 'despues'].map(phase => {
    const imgs = images[phase];
    const imagesHtml = imgs.length
      ? imgs.map(img => `
          <div class="preview-image-wrapper">
            <img src="${img.dataUrl}" alt="${img.name}" />
          </div>
        `).join('')
      : '<div class="preview-empty">Sin imágenes.</div>';

    return `
      <div class="preview-column">
        <div class="preview-column-header ${phase}">
          <span>${phaseLabel[phase]}</span>
          <span class="img-badge">${imgs.length}</span>
        </div>
        <div class="preview-images">${imagesHtml}</div>
        <div class="preview-column-desc">
          <div class="preview-column-desc-label">Descripción</div>
          <div>${document.getElementById('desc-' + phase).value || '—'}</div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="doc-title">${fd.titulo}</div>
    <div class="doc-subtitle">MES DE ${fd.mes} — ${fd.anio}</div>
    <div class="doc-meta">
      <span><strong>Municipio:</strong> ${fd.municipio || '—'}</span>
      <span><strong>Fecha:</strong> ${formatDate(fd.fecha)}</span>
    </div>
    <div class="doc-intro">${fd.descripcion}</div>
    <div class="preview-grid">${phaseColumns}</div>
  `;
}

// ─── GENERATE DOCX (con primera página estilo imagen y imágenes grandes) ───
async function generateDOCX() {
  const btn = document.getElementById('btn-docx');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generando...';

  try {
    if (typeof docx === 'undefined') {
      throw new Error('La librería docx no se cargó. Recarga la página o revisa tu conexión.');
    }

    const fd = getFormData();
    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
      ImageRun, AlignmentType, WidthType, BorderStyle
    } = docx;

    // Helper: dataURL a buffer
    async function dataUrlToBuffer(dataUrl) {
      const res = await fetch(dataUrl);
      return await res.arrayBuffer();
    }

    // Obtener buffers de imágenes
    const antesBuffers = await Promise.all(images.antes.map(img => dataUrlToBuffer(img.dataUrl)));
    const duranteBuffers = await Promise.all(images.durante.map(img => dataUrlToBuffer(img.dataUrl)));
    const despuesBuffers = await Promise.all(images.despues.map(img => dataUrlToBuffer(img.dataUrl)));

    // Tamaño de imagen más grande (ocupará casi toda la celda)
    const imgWidth = 300;  // píxeles
    const imgHeight = 400; // se ajustará automáticamente si se usa solo width? Mejor poner ambos

    const border = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
    const allChildren = [];

    // ========== PÁGINA 1: INFORMACIÓN (estilo imagen) ==========
    // Título
    allChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: fd.titulo, bold: true, size: 28 })]
      }),
      new Paragraph({ text: "" }), // espacio
      // Municipio y Fecha (en dos líneas separadas, como en la imagen)
      new Paragraph({ children: [new TextRun({ text: `Municipio: ${fd.municipio || '—'}`, bold: false, size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: `Fecha: ${formatDate(fd.fecha)}`, bold: false, size: 22 })] }),
      new Paragraph({ text: "" }),
      // Descripción general
      new Paragraph({ children: [new TextRun({ text: fd.descripcion, size: 22 })] }),
      new Paragraph({ text: "" })
    );

    // ANTES
    allChildren.push(
      new Paragraph({ children: [new TextRun({ text: "ANTES:", bold: true, size: 24 })] }),
      new Paragraph({ children: [new TextRun({ text: fd.descAntes || '—', size: 22 })] }),
      new Paragraph({ text: "" })
    );
    // DURANTE
    allChildren.push(
      new Paragraph({ children: [new TextRun({ text: "DURANTE:", bold: true, size: 24 })] }),
      new Paragraph({ children: [new TextRun({ text: fd.descDurante || '—', size: 22 })] }),
      new Paragraph({ text: "" })
    );
    // DESPUÉS
    allChildren.push(
      new Paragraph({ children: [new TextRun({ text: "DESPUÉS:", bold: true, size: 24 })] }),
      new Paragraph({ children: [new TextRun({ text: fd.descDespues || '—', size: 22 })] }),
      new Paragraph({ text: "" })
    );

    // Salto de página después de la información
    allChildren.push(new Paragraph({ pageBreakBefore: true, text: "" }));

    // ========== PÁGINAS DE IMÁGENES ==========
    const maxRows = Math.max(antesBuffers.length, duranteBuffers.length, despuesBuffers.length);
    const rowsPerPage = 2; // 2 filas por página → 6 imágenes
    const totalPages = Math.ceil(maxRows / rowsPerPage);

    for (let page = 0; page < totalPages; page++) {
      const startRow = page * rowsPerPage;
      const endRow = Math.min(startRow + rowsPerPage, maxRows);

      const tableRows = [];

      // Cabecera de columnas
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({ borders: { top: border, bottom: border, left: border, right: border }, children: [new Paragraph({ text: 'ANTES', alignment: AlignmentType.CENTER, bold: true })], shading: { fill: "F2F2F2" } }),
            new TableCell({ borders: { top: border, bottom: border, left: border, right: border }, children: [new Paragraph({ text: 'DURANTE', alignment: AlignmentType.CENTER, bold: true })], shading: { fill: "F2F2F2" } }),
            new TableCell({ borders: { top: border, bottom: border, left: border, right: border }, children: [new Paragraph({ text: 'DESPUÉS', alignment: AlignmentType.CENTER, bold: true })], shading: { fill: "F2F2F2" } })
          ]
        })
      );

      // Filas de imágenes
      for (let i = startRow; i < endRow; i++) {
        const antesBuf = i < antesBuffers.length ? antesBuffers[i] : null;
        const duranteBuf = i < duranteBuffers.length ? duranteBuffers[i] : null;
        const despuesBuf = i < despuesBuffers.length ? despuesBuffers[i] : null;

        const createCell = (buf) => {
          if (!buf) {
            return new TableCell({
              borders: { top: border, bottom: border, left: border, right: border },
              children: [new Paragraph({ text: '—', alignment: AlignmentType.CENTER })],
              verticalAlign: 'center'
            });
          }
          return new TableCell({
            borders: { top: border, bottom: border, left: border, right: border },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new ImageRun({ data: buf, transformation: { width: imgWidth, height: imgHeight } })]
              })
            ],
            verticalAlign: 'center'
          });
        };

        tableRows.push(new TableRow({ children: [createCell(antesBuf), createCell(duranteBuf), createCell(despuesBuf)] }));
      }

      const imageTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
        alignment: AlignmentType.CENTER
      });

      allChildren.push(imageTable);

      if (page < totalPages - 1) {
        allChildren.push(new Paragraph({ pageBreakBefore: true, text: "" }));
      }
    }

    const doc = new Document({ sections: [{ children: allChildren }] });
    const blob = await Packer.toBlob(doc);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Registro_Luminarias_${fd.mes}_${fd.anio}.docx`;
    a.click();

    showToast('✅ Documento Word generado correctamente');
  } catch (error) {
    console.error('Error en generateDOCX:', error);
    showToast(`❌ Error: ${error.message || 'No se pudo generar el Word'}`, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '⬇ Descargar .docx';
  }
}

// ─── TOAST ───
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}