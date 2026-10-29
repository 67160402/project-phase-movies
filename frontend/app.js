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

function renderMovies(movies) {
  const movieList = document.getElementById("movieList");

  // ถ้าไม่มีข้อมูล
  if (movies.length === 0) {
    movieList.innerHTML = `
      <div class="card">
        <p>ไม่พบข้อมูลภาพยนตร์</p>
      </div>
    `;

    return;
  }

  // สร้าง Card ของหนังแต่ละเรื่อง
  movieList.innerHTML = movies
    .map(
      (movie) => `
        <div class="movie-card">
          <h3>${escapeHtml(movie.title)}</h3>

          <p>
            <strong>ID:</strong>
            ${movie.id}
          </p>

          <p>
            <strong>ผู้กำกับ:</strong>
            ${escapeHtml(movie.director)}
          </p>

          <p>
            <strong>ปีที่ฉาย:</strong>
            ${movie.release_year}
          </p>

          <div class="movie-actions">
            <button
              class="edit-button"
              onclick="startEditMovie(${movie.id}, '${escapeHtml(movie.title)}', '${escapeHtml(movie.director)}', ${movie.release_year})"
            >
              แก้ไข
            </button>

            <button
              class="delete-button"
              onclick="deleteMovie(${movie.id})"
            >
              ลบ
            </button>
          </div>
        </div>
      `,
    )
    .join("");
}

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
// Login
// ================================

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

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

    // เก็บ Token ไว้ใน Browser
    localStorage.setItem("movieApiToken", result.token);

    // อ่านข้อมูลจาก Token
    // Backend ส่งข้อมูล id, email และ role อยู่ภายใน Token
    const payload = JSON.parse(atob(result.token.split(".")[1]));

    // เก็บข้อมูล User ที่อ่านได้จาก Token ไว้ใน Browser
    const user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };

    localStorage.setItem("movieApiUser", JSON.stringify(user));

    // แสดงสถานะการเข้าสู่ระบบพร้อม Role
    loginMessage.textContent = `เข้าสู่ระบบสำเร็จ: ${user.role === "admin" ? "Admin" : "User"} (${user.role})`;

    // เปลี่ยนข้อความสถานะ
    updateLoginStatus();
  } catch (error) {
    console.error("Login ไม่สำเร็จ:", error);

    // แสดง Error เป็นภาษาไทย
    loginMessage.textContent = getThaiErrorMessage(error);
  }
});

// ===========================
// ตรวจสอบสถานะ Login ที่มีอยู่แล้ว
// ===========================

function updateLoginStatus() {
  const token = getToken();

  const loginMessage = document.getElementById("loginMessage");

  if (!token) {
    loginMessage.textContent = "ยังไม่ได้เข้าสู่ระบบ";
    return;
  }

  try {
    const user = JSON.parse(localStorage.getItem("movieApiUser") || "{}");

    loginMessage.textContent = `เข้าสู่ระบบแล้ว: ${user.email || "User"} (${user.role || "user"})`;
  } catch {
    loginMessage.textContent = "เข้าสู่ระบบแล้ว";
  }
}

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
    message.textContent = "ปีที่ฉายต้องเป็นตัวเลขจำนวนเต็มมากกว่า 0";
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
      throw new Error(result.error?.message || "ไม่สามารถบันทึกข้อมูลได้");
    }

    // เก็บข้อความแจ้งผลไว้ก่อนล้าง Form
    const successMessage = isEditing ? "แก้ไขภาพยนตร์สำเร็จ" : "เพิ่มภาพยนตร์สำเร็จ";

    // ล้าง Form
    resetMovieForm();

    // แสดงข้อความสำเร็จอีกครั้งหลังล้าง Form
    message.textContent = successMessage;

    // กลับไปหน้าแรก
    currentPage = 1;

    // โหลดข้อมูลใหม่
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
  document.getElementById("movieForm").scrollIntoView({
    behavior: "smooth",
  });
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
      throw new Error(result.error?.message || "ไม่สามารถลบภาพยนตร์ได้");
    }

    // แสดงข้อความสำเร็จใต้ฟอร์ม
    document.getElementById("movieFormMessage").textContent = "ลบภาพยนตร์สำเร็จ";

    // ถ้าลบรายการสุดท้ายของหน้า ให้ย้อนกลับไปหน้าก่อนหน้า
    if (currentPage > 1) {
      currentPage--;
    }

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
