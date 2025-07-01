const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzVvI4JkC0cqrPypviwEqh-W2lgyyCCUrn5ajT7krZW5kgdV3fpj1rIORlZqNPhv1FL/exec";
let masterData = [], beratData = [];
let page = 1, pageSize = 10, filter = "";

function showAlert(msg, ok=true) {
  alert(msg);
}

// Load master dan berat badan
async function loadAll() {
  document.getElementById("statusSync").textContent = "⏳ Memuat data...";
  let m = await fetch(SCRIPT_URL + "?action=getMaster").then(r => r.json());
  let b = await fetch(SCRIPT_URL + "?action=getBerat").then(r => r.json());
  if (m.success && b.success) {
    masterData = m.data; beratData = b.data;
    document.getElementById("statusSync").textContent = "Data sinkron!";
    renderTable();
  } else {
    document.getElementById("statusSync").textContent = "Gagal sinkron!";
  }
}

function renderTable() {
  let rows = [];
  // Gabung data berat + master
  let merged = beratData.map(bd => {
    let m = masterData.find(md => md.NIK === bd.NIK) || {};
    let tinggi = parseFloat(m.Tinggi || 0);
    let berat = parseFloat(bd.Berat || 0);
    let bmi = tinggi ? (berat / ((tinggi/100)*(tinggi/100))).toFixed(1) : "-";
    let status = "-";
    let saran = "-";
    if (bmi !== "-") {
      let val = parseFloat(bmi);
      if (val < 18.5) {status="Underweight"; saran=`Naikkan ${(18.5*(tinggi/100)*(tinggi/100)-berat).toFixed(1)} kg`;}
      else if (val < 23) {status="Normal"; saran="Pertahankan";}
      else if (val < 27.5) {status="Overweight"; saran=`Turunkan ${(berat-22.9*(tinggi/100)*(tinggi/100)).toFixed(1)} kg`;}
      else {status="Obese"; saran=`Turunkan ${(berat-22.9*(tinggi/100)*(tinggi/100)).toFixed(1)} kg`;}
    }
    return {...bd, ...m, BMI:bmi, Status:status, Saran:saran};
  });

  // Filter & paging
  let f = filter.trim().toLowerCase();
  if (f) merged = merged.filter(d => (d.NIK+d.Nama+d.Region+d.Program+d.Unit).toLowerCase().includes(f));
  let total = merged.length, maxPage = Math.ceil(total/pageSize);
  let data = merged.slice((page-1)*pageSize, page*pageSize);

  rows = data.map((d,i) => `
    <tr>
      <td>${(page-1)*pageSize + i+1}</td>
      <td>${d.Tanggal}</td>
      <td>${d.NIK}</td>
      <td>${d.Nama||'-'}</td>
      <td>${d.Program||'-'}</td>
      <td>${d.Region||'-'}</td>
      <td>${d.Unit||'-'}</td>
      <td>${d.Tinggi||'-'}</td>
      <td>${d.Berat}</td>
      <td>${d.BMI}</td>
      <td>${d.Status}</td>
      <td>${d.Saran}</td>
    </tr>
  `).join("");
  document.getElementById("tbodyReport").innerHTML = rows;

  // Paging
  let p = [];
  for(let i=1; i<=maxPage; i++) {
    if(i==1||i==maxPage||Math.abs(i-page)<2) {
      p.push(`<li class="page-item ${i==page?'active':''}"><a class="page-link" href="#" onclick="gotoPage(${i})">${i}</a></li>`);
    }
    else if(p[p.length-1]!==`<li class="page-item disabled"><span class="page-link">…</span></li>`)
      p.push(`<li class="page-item disabled"><span class="page-link">…</span></li>`);
  }
  document.getElementById("paging").innerHTML = p.join("");
}
window.gotoPage = function(i){page=i;renderTable();}

document.getElementById("searchNIK").oninput = function(){
  filter = this.value; page = 1; renderTable();
};

// Form master data
document.getElementById("formMaster").onsubmit = async function(e){
  e.preventDefault();
  let data = {
    NIK: mNIK.value.trim(), Nama: mNama.value.trim(), Program: mProgram.value.trim(),
    Region: mRegion.value.trim(), Unit: mUnit.value.trim(), Tinggi: mTinggi.value
  };
  let r = await fetch(SCRIPT_URL+"?action=addMaster&data="+encodeURIComponent(JSON.stringify(data))).then(r=>r.json());
  if(r.success) { showAlert("Data master berhasil ditambah!"); loadAll();}
  else showAlert(r.msg, false);
  this.reset();
  document.getElementById("modalMaster").querySelector(".btn-close").click();
};

// Import master data (Excel)
document.getElementById("importMaster").onchange = function(e){
  let file = e.target.files[0];
  if(!file) return;
  let reader = new FileReader();
  reader.onload = async function(ev){
    let wb = XLSX.read(ev.target.result, {type:'binary'});
    let ws = wb.Sheets[wb.SheetNames[0]];
    let data = XLSX.utils.sheet_to_json(ws);
    // Sesuaikan field jika perlu
    let payload = data.map(d=>({
      NIK:d.NIK, Nama:d.Nama, Program:d.Program, Region:d.Region, Unit:d.Unit, Tinggi:d.TinggiBadan||d.Tinggi
    }));
    let r = await fetch(SCRIPT_URL+"?action=importMaster&data="+encodeURIComponent(JSON.stringify(payload))).then(r=>r.json());
    if(r.success) { showAlert("Import sukses!"); loadAll();}
    else showAlert(r.msg, false);
  };
  reader.readAsBinaryString(file);
};

// Form input berat badan
document.getElementById("formBerat").onsubmit = async function(e){
  e.preventDefault();
  let data = {
    Tanggal: bTanggal.value, NIK: bNIK.value.trim(), Berat: bBerat.value
  };
  let r = await fetch(SCRIPT_URL+"?action=addBerat&data="+encodeURIComponent(JSON.stringify(data))).then(r=>r.json());
  if(r.success) { showAlert("Data berat badan disimpan!"); loadAll();}
  else showAlert(r.msg, false);
  this.reset();
  document.getElementById("modalBerat").querySelector(".btn-close").click();
};

// Otomatis isi data master saat NIK diinput pada form berat
document.getElementById("bNIK").oninput = function(){
  let m = masterData.find(x=>x.NIK===this.value.trim());
  bNama.textContent = m?m.Nama:'-';
  bProgram.textContent = m?m.Program:'-';
  bRegion.textContent = m?m.Region:'-';
  bUnit.textContent = m?m.Unit:'-';
  bTinggi.textContent = m?m.Tinggi:'-';
};
// Tampilkan info BMI saat input berat berubah
document.getElementById("bBerat").oninput = function(){
  let tinggi = parseFloat(bTinggi.textContent);
  let berat = parseFloat(this.value);
  if(tinggi && berat) {
    let bmi = berat/((tinggi/100)*(tinggi/100));
    let saran = "", status = "";
    if(bmi < 18.5) { status="Underweight"; saran="Naikkan berat badan";}
    else if(bmi < 23) {status="Normal"; saran="Pertahankan berat badan";}
    else if(bmi < 27.5) {status="Overweight"; saran="Turunkan berat badan";}
    else {status="Obese"; saran="Turunkan berat badan lebih banyak";}
    infoBMI.textContent = `BMI: ${bmi.toFixed(1)} (${status}) | Saran: ${saran}`;
  } else infoBMI.textContent = "";
};

// Set default tanggal pada form berat
document.getElementById("modalBerat").addEventListener("show.bs.modal", function(){
  let d = new Date(), m = String(d.getMonth()+1).padStart(2,'0'), t = String(d.getDate()).padStart(2,'0');
  bTanggal.value = d.getFullYear()+"-"+m+"-"+t;
  // restore last date if ada (optional)
});

// Sync button
document.getElementById("btnSync").onclick = loadAll;

// Auto load on startup
loadAll();
