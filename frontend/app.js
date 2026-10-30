// ======================
// ตัวแปรสำหรับควบคุมหน้าเว็บ
// ======================

// หน้าที่กำลังแสดงผล
let currentPage = 1;

// ให้แสดงหนัง 8 เรื่องต่อหน้า
const limit = 8;

// จำนวนหน้าทั้งหมดจาก API
let totalPages = 1;

// เก็บ ID หนังที่กำลังแก้ไข
let editingMovieId = null;

// ===============
// ฟังก์ชันช่วยเหลือ
// ===============

// ดึง Token ที่เก็บไว้หลัง Login
function getToken() {
  return localStorage.getItem("movieApiToken");
}

// สร้าง Header สำหรับ Request ที่ต้องใช้ Token
function getAuthHeaders() {
  const token = getToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
    : {
        "Content-Type": "application/json",
      };
}

// แปลง Error จาก Browser หรือ Network ให้เป็นข้อความภาษาไทย
function getThaiErrorMessage(error) {
  if (error.message === "Failed to fetch") {
    return "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่า Server กำลังทำงานอยู่";
  }

  if (error.message === "NetworkError when attempting to fetch resource.") {
    return "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่า Server กำลังทำงานอยู่";
  }

  if (error.message === "Load failed") {
    return "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่า Server กำลังทำงานอยู่";
  }

  return error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

// =================
// แสดงสถานะการโหลด
// =================

function showLoading(show) {
  document.getElementById("loading").hidden = !show;
}

// ============
// แสดง Error
// ============

function showError(message) {
  document.getElementById("errorMessage").textContent = message;
}

function clearError() {
  document.getElementById("errorMessage").textContent = "";
}

// ==================
// โหลดรายการภาพยนตร์
// ==================

async function loadMovies() {
  showLoading(true);
  clearError();

  try {
    // รับค่าการค้นหาจากช่องค้นหา
    const search = document.getElementById("searchInput").value.trim();

    // รับค่าการเรียงข้อมูลจาก Select Box
    const sort = document.getElementById("sortSelect").value;
    const order = document.getElementById("orderSelect").value;

    // สร้าง URL สำหรับเรียก API โดยส่งค่าการค้นหา การเรียงข้อมูล และ Pagination
    const params = new URLSearchParams({
      page: currentPage,
      limit: limit,
      q: search,
      sort: sort,
      order: order,
    });

    const response = await fetch(`/api/v1/movies?${params.toString()}`);

    const result = await response.json();

    // ถ้า API ตอบกลับด้วย Error
    if (!response.ok) {
      throw new Error(result.error?.message || "ไม่สามารถโหลดข้อมูลภาพยนตร์ได้");
    }

    // ถ้าหน้าปัจจุบันไม่มีข้อมูลแล้ว (เช่น ลบเรื่องสุดท้ายของหน้าสุดท้าย) ให้ย้อนไปหน้าสุดท้ายที่ยังมีข้อมูล
    if (result.data.length === 0 && result.pagination.totalPages > 0 && currentPage > result.pagination.totalPages) {
      currentPage = result.pagination.totalPages;
      await loadMovies();
      return;
    }

    // เก็บจำนวนหน้าทั้งหมดจาก API
    totalPages = result.pagination.totalPages;

    // แสดงข้อมูลหนังบนหน้าเว็บ
    renderMovies(result.data);

    // อัปเดต Pagination บนหน้าเว็บ
    updatePagination(result.pagination);
  } catch (error) {
    console.error("โหลด Movies ไม่สำเร็จ:", error);

    // แสดง Error เป็นภาษาไทย
    showError(getThaiErrorMessage(error));

    document.getElementById("movieList").innerHTML = "";
  } finally {
    showLoading(false);
  }
}

// ======================
// แสดงรายการหนังบนหน้าเว็บ
// ======================

// เก็บรายการหนังที่แสดงอยู่ตอนนี้ ตอนกดปุ่ม "แก้ไข" (เพื่อดึงชื่อ/ผู้กำกับ/ปีมาใส่ฟอร์ม) .CA
let loadedMovies = [];

// สร้างตัวเลขสี (0-360) จากชื่อหนัง เอาไปทำสีโปสเตอร์ หากชื่อเดิมจะได้สีเดิมทุกครั้ง ชื่อต่างกันสีก็ต่างกัน .CA
function hueFrom(text) {
  let h = 0;
  for (const c of String(text)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

// แสดงรายการหนังเป็นโปสเตอร์ (แทน renderMovies ตัวเดิม) .CAF
function renderMovies(movies) {
  const movieList = document.getElementById("movieList");
  loadedMovies = movies; // จำไว้ใช้ตอนกดแก้ไข

  // ถ้าไม่มีข้อมูล
  if (movies.length === 0) {
    movieList.innerHTML = `
      <div class="card">
        <p>ไม่พบข้อมูลภาพยนตร์</p>
      </div>
    `;

    return;
  }

  // สร้างโปสเตอร์ของหนังแต่ละเรื่อง
  // --h คือสีของโปสเตอร์ ส่งให้ CSS ใช้ผ่านตัวแปร
  // data-action และ data-id ใช้บอกว่าปุ่มนี้ทำอะไรและเป็นของหนังเรื่องไหน
  movieList.innerHTML = movies
    .map(
      (movie) => `
        <article class="movie-card">
          <div class="poster" style="--h:${hueFrom(movie.title)}">
            <h3 class="poster-title">${escapeHtml(movie.title)}</h3>
            <div class="poster-meta">
              <span>${movie.release_year}</span>
              <span>ID ${movie.id}</span>
            </div>
          </div>
          <div class="movie-info">
            <p>${escapeHtml(movie.director)}</p>
            <div class="movie-actions">
              <button class="edit-button" data-action="edit" data-id="${movie.id}">แก้ไข</button>
              <button class="delete-button" data-action="delete" data-id="${movie.id}">ลบ</button>
            </div>
          </div>
        </article>`,
    )
    .join("");
}

// ดักการคลิกปุ่มแก้ไข/ลบในรายการหนัง ด้วย event เดียว .CA
document.getElementById("movieList").addEventListener("click", (event) => {
  // หาปุ่มที่ถูกกด (ถ้าคลิกที่อื่นในการ์ดให้ข้ามไป)
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);

  // ปุ่มลบ: เรียกฟังก์ชันลบเดิม
  if (button.dataset.action === "delete") {
    deleteMovie(id);
    return;
  }

  // ปุ่มแก้ไข: หาข้อมูลหนังเรื่องนั้น แล้วใส่ลงฟอร์มด้วยฟังก์ชันเดิม
  const movie = loadedMovies.find((m) => m.id === id);
  if (movie) startEditMovie(movie.id, movie.title, movie.director, movie.release_year);
});

// ================================
// ป้องกัน HTML Injection
// ================================

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

// ================================
// Pagination
// ================================

function updatePagination(pagination) {
  const pageInfo = document.getElementById("pageInfo");
  const previousButton = document.getElementById("previousButton");
  const nextButton = document.getElementById("nextButton");

  pageInfo.textContent = `หน้า ${pagination.page} / ${pagination.totalPages || 1}`;

  previousButton.disabled = pagination.page <= 1;

  nextButton.disabled = pagination.page >= pagination.totalPages || pagination.totalPages === 0;
}

// ปุ่มก่อนหน้า
document.getElementById("previousButton").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    loadMovies();
  }
});

// ปุ่มถัดไป
document.getElementById("nextButton").addEventListener("click", () => {
  if (currentPage < totalPages) {
    currentPage++;
    loadMovies();
  }
});

// ================================
// ค้นหา
// ================================

document.getElementById("searchButton").addEventListener("click", () => {
  // เริ่มจากหน้าแรกทุกครั้งที่ค้นหา
  currentPage = 1;

  loadMovies();
});

// กด Enter ในช่องค้นหาได้
document.getElementById("searchInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    currentPage = 1;
    loadMovies();
  }
});

// ================================
// Login / Logout
// ================================

// อ่านข้อมูลที่อยู่ใน Token (id, email, role, exp) ถ้าอ่านไม่ได้จะคืนค่า null
function parseToken(token) {
  try {
    // Token ใช้ base64url (มี - และ _) ต้องแปลงเป็น base64 ปกติก่อนใช้ atob
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// ลบข้อมูลการเข้าสู่ระบบออกจาก Browser
function clearLogin() {
  localStorage.removeItem("movieApiToken");
  localStorage.removeItem("movieApiUser");
}

// คืนข้อมูลผู้ใช้ที่เข้าสู่ระบบอยู่ ถ้าไม่มี Token หรือ Token หมดอายุแล้วจะคืน null
function getLoggedInUser() {
  const token = getToken();

  if (!token) {
    return null;
  }

  const payload = parseToken(token);

  // exp เป็นหน่วยวินาที ต้องคูณ 1000 ให้เป็นมิลลิวินาทีก่อนเทียบกับเวลาปัจจุบัน
  if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
    clearLogin();
    return null;
  }

  return { id: payload.id, email: payload.email, role: payload.role };
}

// ถ้า Backend ตอบ 401 ตอนมี Token แปลว่า Token หมดอายุ ให้ล้างสถานะแล้วให้เข้าสู่ระบบใหม่
function handleExpiredLogin() {
  if (!getToken()) {
    return;
  }

  clearLogin();
  updateLoginStatus();
  document.getElementById("loginMessage").textContent = "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
}

// ส่ง Email และ Password ไปขอ Token แล้วเก็บไว้ใน Browser (ถ้าไม่สำเร็จจะ throw Error)
async function requestLogin(email, password) {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      email,
      password,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error?.message || "เข้าสู่ระบบไม่สำเร็จ");
  }

  localStorage.setItem("movieApiToken", result.token);
}

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  // ถ้าเข้าสู่ระบบอยู่แล้ว ปุ่มนี้คือปุ่ม "ออกจากระบบ"
  if (getLoggedInUser()) {
    clearLogin();
    updateLoginStatus();
    return;
  }

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const loginMessage = document.getElementById("loginMessage");

  // ================================
  // Login Validation
  // ================================

  if (!email) {
    loginMessage.textContent = "กรุณากรอก Email";
    return;
  }

  if (!password) {
    loginMessage.textContent = "กรุณากรอกรหัสผ่าน";
    return;
  }

  loginMessage.textContent = "กำลังเข้าสู่ระบบ...";

  try {
    await requestLogin(email, password);

    // เปลี่ยนหน้าตาฟอร์มเป็นสถานะ "เข้าสู่ระบบแล้ว"
    updateLoginStatus();
  } catch (error) {
    console.error("Login ไม่สำเร็จ:", error);

    // แสดง Error เป็นภาษาไทย
    loginMessage.textContent = getThaiErrorMessage(error);
  }
});

// ===========================
// อัปเดตหน้าตาฟอร์มตามสถานะ Login
// ===========================

function updateLoginStatus() {
  const user = getLoggedInUser();

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const roleInput = document.getElementById("roleDisplay");
  const loginButton = document.getElementById("loginButton");
  const loginMessage = document.getElementById("loginMessage");

  if (user) {
    // เข้าสู่ระบบแล้ว: ช่องอีเมลแสดงอีเมลผู้ใช้ ช่องรหัสผ่านถูกแทนด้วย Role
    emailInput.value = user.email;
    emailInput.readOnly = true;

    passwordInput.value = "";
    passwordInput.hidden = true;

    roleInput.value = `Role: ${user.role}`;
    roleInput.hidden = false;

    loginButton.textContent = "ออกจากระบบ";
    loginMessage.textContent = "เข้าสู่ระบบแล้ว";
  } else {
    // ยังไม่ได้เข้าสู่ระบบ (หรือ Token หมดอายุ): กลับเป็นฟอร์มปกติ
    emailInput.value = "";
    emailInput.readOnly = false;

    passwordInput.value = "";
    passwordInput.hidden = false;

    roleInput.hidden = true;

    loginButton.textContent = "เข้าสู่ระบบ";
    loginMessage.textContent = "กรุณาเข้าสู่ระบบ";
  }
}

// ================================
// สมัครสมาชิก
// ================================

document.getElementById("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;

  const registerMessage = document.getElementById("registerMessage");

  if (!email) {
    registerMessage.textContent = "กรุณากรอก Email";
    return;
  }

  if (!password) {
    registerMessage.textContent = "กรุณากรอกรหัสผ่าน";
    return;
  }

  // ตามเอกสาร openapi.yaml รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร
  if (password.length < 6) {
    registerMessage.textContent = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
    return;
  }

  registerMessage.textContent = "กำลังสมัครสมาชิก...";

  try {
    const response = await fetch("/api/v1/auth/register", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        email,
        password,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error?.message || "สมัครสมาชิกไม่สำเร็จ");
    }

    document.getElementById("registerForm").reset();

    // ถ้าเข้าสู่ระบบอยู่ (เช่น Admin) ไม่สลับบัญชีให้ ผู้ใช้ต้องออกจากระบบเอง
    if (getLoggedInUser()) {
      registerMessage.textContent = "สมัครสมาชิกสำเร็จ (ออกจากระบบก่อน แล้วเข้าสู่ระบบด้วยบัญชีใหม่)";
      return;
    }

    // Backend ไม่ส่ง Token กลับมาตอนสมัคร จึงเข้าสู่ระบบให้อัตโนมัติด้วยอีเมลและรหัสผ่านเดิม
    try {
      await requestLogin(email, password);
      updateLoginStatus();
      registerMessage.textContent = "สมัครสมาชิกสำเร็จ และเข้าสู่ระบบแล้ว";
    } catch {
      registerMessage.textContent = "สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ";
    }
  } catch (error) {
    console.error("สมัครสมาชิกไม่สำเร็จ:", error);

    // แสดง Error เป็นภาษาไทย
    registerMessage.textContent = getThaiErrorMessage(error);
  }
});

// =====================
// เพิ่ม / แก้ไขภาพยนตร์
// =====================

document.getElementById("movieForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = document.getElementById("movieTitle").value.trim();
  const director = document.getElementById("movieDirector").value.trim();

  const year = Number(document.getElementById("movieYear").value);

  const message = document.getElementById("movieFormMessage");

  // =====================
  // Frontend Validation
  // =====================

  if (!title) {
    message.textContent = "กรุณากรอกชื่อภาพยนตร์";
    return;
  }

  if (!director) {
    message.textContent = "กรุณากรอกชื่อผู้กำกับ";
    return;
  }

  if (!Number.isInteger(year) || year < 1) {
    message.textContent = "ปีที่ฉายต้องมากกว่า 0";
    return;
  }

  // ========================
  // ตรวจสอบว่ากำลังเพิ่มหรือแก้ไข
  // ========================

  const isEditing = editingMovieId !== null;

  const url = isEditing ? `/api/v1/movies/${editingMovieId}` : "/api/v1/movies";

  const method = isEditing ? "PUT" : "POST";

  message.textContent = "กำลังบันทึก...";

  try {
    const response = await fetch(url, {
      method,

      headers: getAuthHeaders(),

      body: JSON.stringify({
        title,
        director,
        release_year: year,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      // Token หมดอายุหรือไม่ถูกต้อง ให้ล้างสถานะเข้าสู่ระบบ
      if (response.status === 401) handleExpiredLogin();

      throw new Error(result.error?.message || "ไม่สามารถบันทึกข้อมูลได้");
    }

    // เก็บข้อความแจ้งผลไว้ก่อนล้าง Form
    const successMessage = isEditing ? "แก้ไขภาพยนตร์สำเร็จ" : "เพิ่มภาพยนตร์สำเร็จ";

    // ล้าง Form
    resetMovieForm();

    // แสดงข้อความสำเร็จอีกครั้งหลังล้าง Form
    message.textContent = successMessage;

    // โหลดข้อมูลใหม่ (อยู่หน้าเดิม ไม่เด้งกลับหน้าแรก)
    await loadMovies();
  } catch (error) {
    console.error("บันทึก Movie ไม่สำเร็จ:", error);

    // แสดง Error เป็นภาษาไทย
    message.textContent = getThaiErrorMessage(error);
  }
});
// ==================
// เริ่มแก้ไขภาพยนตร์
// ==================
function startEditMovie(id, title, director, year) {
  editingMovieId = id;

  document.getElementById("movieTitle").value = title;

  document.getElementById("movieDirector").value = director;

  document.getElementById("movieYear").value = year;

  document.getElementById("formTitle").textContent = `แก้ไขภาพยนตร์ ID ${id}`;

  document.getElementById("cancelEditButton").hidden = false;

  document.getElementById("movieFormMessage").textContent = "กำลังแก้ไขข้อมูลภาพยนตร์";

  // เลื่อนหน้าจอไปยัง Form เพื่อให้ผู้ใช้เห็นทันที
  document.getElementById("movieForm").scrollIntoView({ behavior: "smooth" });
}
// =================
// ยกเลิกการแก้ไข
// =================
document.getElementById("cancelEditButton").addEventListener("click", () => {
  resetMovieForm();
});

function resetMovieForm() {
  editingMovieId = null;

  document.getElementById("movieForm").reset();
  document.getElementById("formTitle").textContent = "เพิ่มภาพยนตร์";
  document.getElementById("cancelEditButton").hidden = true;
  document.getElementById("movieFormMessage").textContent = "";
}
// =================
// ลบภาพยนตร์
// =================
async function deleteMovie(id) {
  const confirmed = confirm(`ต้องการลบภาพยนตร์ ID ${id} ใช่หรือไม่?`);

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`/api/v1/movies/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    const result = await response.json();

    if (!response.ok) {
      // Token หมดอายุหรือไม่ถูกต้อง ให้ล้างสถานะเข้าสู่ระบบ
      if (response.status === 401) handleExpiredLogin();

      throw new Error(result.error?.message || "ไม่สามารถลบภาพยนตร์ได้");
    }
    // แสดงข้อความสำเร็จใต้ฟอร์ม
    document.getElementById("movieFormMessage").textContent = "ลบภาพยนตร์สำเร็จ";
    // โหลดข้อมูลใหม่ (อยู่หน้าเดิม ถ้าหน้านี้ไม่มีข้อมูลแล้ว loadMovies จะย้อนหน้าให้เอง)
    await loadMovies();
  } catch (error) {
    console.error("ลบ Movie ไม่สำเร็จ:", error);

    // แสดง Error เป็นภาษาไทย
    document.getElementById("movieFormMessage").textContent = getThaiErrorMessage(error);
  }
}
// ===============
// เริ่มต้นโหลดหน้าเว็บ
// ===============

// แสดงสถานะ Login ที่มีอยู่แล้ว
updateLoginStatus();
// โหลด Movie จาก API
loadMovies();
