const $ = s => document.querySelector(s);

$('#send').onclick = async () => {
  const f = $('#file').files[0];
  const kg = $('#kg').value;
  if (!f || !kg) { $('#status').textContent = 'Selecione arquivo e informe peso alvo.'; return; }
  const fd = new FormData();
  fd.append('file', f);
  fd.append('targetKg', kg);
  $('#status').textContent = 'Processando...';
  $('#result').textContent = '';
  try {
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Falha no processamento');
    render(j);
    $('#status').textContent = 'Pronto.';
  } catch (e) {
    $('#status').textContent = 'Erro: ' + e.message;
  }
};

function render(j){
  if (!j || !j.itens) { $('#result').textContent = 'Nada retornado.'; return; }
  let html = '';
  html += `<div><b>Produto:</b> ${j.produto||'-'} &nbsp; <b>Cor:</b> ${j.cor||'-'}</div>`;
  html += `<div><b>Base detectada:</b> ${j.base_kg_detectada} kg &nbsp; <b>Peso alvo:</b> ${j.peso_alvo_kg} kg</div>`;
  html += `<table><thead><tr><th>Pigmento</th><th>Valor lido</th><th>Partes lidas</th><th>Partes escaladas</th><th>Resultado</th></tr></thead><tbody>`;
  for (const it of j.itens){
    html += `<tr>
      <td>${it.pigmento}</td>
      <td>${it.valor_lido}</td>
      <td>${(it.partes_lidas??0).toFixed(2)}</td>
      <td>${(it.partes_escaladas??0).toFixed(2)}</td>
      <td><b>${it.y_formatado}</b></td>
    </tr>`;
  }
  html += `</tbody></table>`;
  $('#result').innerHTML = html;
}
