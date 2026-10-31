require("dotenv").config();

const express = require("express");
const path = require("path");
const pool = require("../db");

const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const { searchExternalMovie } = require("./services/external-api");

// Middleware สำหรับจัดการ Pagination, Sort และ Search
const { parsePagination, parseSort, parseSearch } = require("./middleware/query-parser");

// Middleware สำหรับป้องกันการเรียก API มากเกินไป (Rate Limiter)
const { generalLimiter } = require("./middleware/rateLimiter");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// จำกัดจำนวน Request ที่เข้ามายัง API (100 ครั้ง / นาที)
app.use("/api/v1", generalLimiter);

// เอกสาร API ด้วย Swagger UI (ปิดใน Production)
if (process.env.NODE_ENV !== "production") {
  const swaggerDocument = YAML.load("./openapi.yaml");
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// เปิด Frontend จากโฟลเดอร์ frontend (เข้า http://localhost:3000 จะได้ index.html)
app.use(express.static(path.join(__dirname, "../frontend")));

// ===============
// ฟังก์ชันช่วยเหลือ
// ===============

// ส่ง Error กลับไปในรูปแบบเดียวกันทุก Endpoint: { error: { code, message } }
function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

// ตรวจข้อมูลภาพยนตร์ที่ส่งมา (ใช้ทั้งตอนเพิ่มและแก้ไข)
// title, director ต้องเป็นข้อความที่ไม่ว่าง และ release_year ต้องเป็นจำนวนเต็มบวก
function isValidMovie({ title, director, release_year }) {
  return (
    typeof title === "string" &&
    title.trim() !== "" &&
    typeof director === "string" &&
    director.trim() !== "" &&
    Number.isInteger(release_year) &&
    release_year > 0
  );
}

// ดึงภาพยนตร์ 1 เรื่องจาก ID ถ้าไม่พบจะคืน undefined
async function findMovie(id) {
  const [rows] = await pool.query("SELECT id, title, director, release_year FROM movies WHERE id = ?", [id]);
  return rows[0];
}

// =========
// Movies
// =========

// GET /api/v1/movies
// ดึงรายการภาพยนตร์แบบแบ่งหน้า
// Query: page (เริ่ม 1), limit (1-100, ค่าเริ่มต้น 8), q (ค้นหาจากชื่อหนังหรือผู้กำกับ),
//        sort (id | title | director | release_year), order (asc | desc)
// ทำงาน: สร้าง WHERE จากคำค้น -> ดึงข้อมูลตาม LIMIT/OFFSET -> นับจำนวนทั้งหมดเพื่อคำนวณจำนวนหน้า
// ตอบกลับ: 200 { data: [...movies], pagination: { page, limit, total, totalPages } }
app.get("/api/v1/movies", parsePagination, parseSort, parseSearch, async (req, res, next) => {
  try {
    const { page, limit, offset } = req.pagination;
    const { field, order } = req.sort;
    const { q } = req.search;

    // ถ้ามีคำค้น ให้ค้นจากชื่อหนังหรือชื่อผู้กำกับ
    const where = q ? "WHERE title LIKE ? OR director LIKE ?" : "";
    const params = q ? [`%${q}%`, `%${q}%`] : [];

    // field และ order ผ่านการตรวจสอบจาก allowlist ใน query-parser แล้ว จึงใส่ใน SQL ได้
    const [rows] = await pool.query(
      `SELECT id, title, director, release_year FROM movies ${where}
       ORDER BY ${field} ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM movies ${where}`, params);

    res.status(200).json({
      message: "สำเร็จ",
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/movies/:id
// ดึงภาพยนตร์ 1 เรื่องตาม ID
// ตอบกลับ: 200 { data: movie } หรือ 404 ถ้าไม่พบ
app.get("/api/v1/movies/:id", async (req, res, next) => {
  try {
    const movie = await findMovie(req.params.id);

    if (!movie) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลภาพยนตร์");
    }

    res.status(200).json({ message: "สำเร็จ", data: movie });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/movies
// เพิ่มภาพยนตร์ใหม่
// Body: { title, director, release_year }
// ทำงาน: ตรวจข้อมูล -> INSERT ลงตาราง movies -> ดึงข้อมูลที่เพิ่งเพิ่มกลับไป
// ตอบกลับ: 201 { data: movie } หรือ 400 ถ้าข้อมูลไม่ถูกต้อง
app.post("/api/v1/movies", async (req, res, next) => {
  try {
    if (!isValidMovie(req.body)) {
      return sendError(res, 400, "VALIDATION_ERROR", "กรุณาระบุ title, director และ release_year ให้ถูกต้อง");
    }

    const { title, director, release_year } = req.body;

    const [result] = await pool.query("INSERT INTO movies (title, director, release_year) VALUES (?, ?, ?)", [
      title.trim(),
      director.trim(),
      release_year,
    ]);

    res.status(201).json({ message: "เพิ่มภาพยนตร์สำเร็จ", data: await findMovie(result.insertId) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/movies/:id
// แก้ไขข้อมูลภาพยนตร์ (ต้องส่งข้อมูลครบทุก field)
// Body: { title, director, release_year }
// ทำงาน: ตรวจข้อมูล -> UPDATE -> ถ้าไม่มีแถวถูกแก้ แปลว่าไม่พบ ID นี้
// ตอบกลับ: 200 { data: movie }, 400 ถ้าข้อมูลไม่ถูกต้อง หรือ 404 ถ้าไม่พบ
app.put("/api/v1/movies/:id", async (req, res, next) => {
  try {
    if (!isValidMovie(req.body)) {
      return sendError(res, 400, "VALIDATION_ERROR", "กรุณาระบุ title, director และ release_year ให้ถูกต้อง");
    }

    const { title, director, release_year } = req.body;

    const [result] = await pool.query("UPDATE movies SET title = ?, director = ?, release_year = ? WHERE id = ?", [
      title.trim(),
      director.trim(),
      release_year,
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลภาพยนตร์");
    }

    res.status(200).json({ message: "แก้ไขภาพยนตร์สำเร็จ", data: await findMovie(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/movies/:id
// ลบภาพยนตร์ (ข้อมูลใน movie_genres ของหนังเรื่องนี้จะถูกลบตามอัตโนมัติด้วย ON DELETE CASCADE)
// ตอบกลับ: 200 หรือ 404 ถ้าไม่พบ
app.delete("/api/v1/movies/:id", async (req, res, next) => {
  try {
    const [result] = await pool.query("DELETE FROM movies WHERE id = ?", [req.params.id]);

    if (result.affectedRows === 0) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลภาพยนตร์");
    }

    res.status(200).json({ message: "ลบภาพยนตร์สำเร็จ" });
  } catch (err) {
    next(err);
  }
});

// =========
// Genres
// =========

// GET /api/v1/genres
// ดึงประเภทภาพยนตร์ทั้งหมด เรียงตาม ID
// ตอบกลับ: 200 { data: [{ id, name }] }
app.get("/api/v1/genres", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT id, name FROM genres ORDER BY id");

    res.status(200).json({ message: "สำเร็จ", data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/genres
// เพิ่มประเภทภาพยนตร์ใหม่
// Body: { name }
// ทำงาน: ตรวจชื่อ -> INSERT (คอลัมน์ name เป็น UNIQUE ถ้าชื่อซ้ำ MySQL จะส่ง ER_DUP_ENTRY)
// ตอบกลับ: 201 { data: { id, name } }, 400 ถ้าไม่ระบุชื่อ หรือ 409 ถ้าชื่อซ้ำ
app.post("/api/v1/genres", async (req, res, next) => {
  try {
    const { name } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return sendError(res, 400, "VALIDATION_ERROR", "กรุณาระบุชื่อประเภทภาพยนตร์");
    }

    const [result] = await pool.query("INSERT INTO genres (name) VALUES (?)", [name.trim()]);

    res.status(201).json({
      message: "เพิ่มประเภทภาพยนตร์สำเร็จ",
      data: { id: result.insertId, name: name.trim() },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return sendError(res, 409, "DUPLICATE_GENRE", "มีประเภทภาพยนตร์นี้อยู่แล้ว");
    }

    next(err);
  }
});

// ==============
// Movie ↔ Genre
// ==============

// GET /api/v1/movies/:id/genres
// ดึงประเภททั้งหมดของภาพยนตร์เรื่องนี้ (JOIN ตาราง genres กับ movie_genres)
// ตอบกลับ: 200 { data: [{ id, name }] } หรือ 404 ถ้าไม่พบภาพยนตร์
app.get("/api/v1/movies/:id/genres", async (req, res, next) => {
  try {
    if (!(await findMovie(req.params.id))) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลภาพยนตร์");
    }

    const [rows] = await pool.query(
      `SELECT g.id, g.name FROM genres g
       JOIN movie_genres mg ON mg.genre_id = g.id
       WHERE mg.movie_id = ?
       ORDER BY g.id`,
      [req.params.id],
    );

    res.status(200).json({ message: "สำเร็จ", data: rows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/movies/:id/genres
// กำหนดประเภทให้ภาพยนตร์ โดย "แทนที่" ของเดิมทั้งหมด (ส่ง [] = ลบประเภทออกทั้งหมด)
// Body: { genre_ids: [1, 3] }
// ทำงาน: ตรวจ genre_ids -> ตรวจว่ามีหนังและทุก genre อยู่จริง
//        -> ลบความสัมพันธ์เดิม แล้วเพิ่มใหม่ ภายใน Transaction (สำเร็จทั้งหมดหรือไม่เปลี่ยนเลย)
// ตอบกลับ: 200 { movie_id, genre_ids }, 400 ถ้าข้อมูลไม่ถูกต้อง หรือ 404 ถ้าไม่พบภาพยนตร์
app.put("/api/v1/movies/:id/genres", async (req, res, next) => {
  const { genre_ids } = req.body;
  const movieId = Number(req.params.id);

  // ต้องเป็น array ของจำนวนเต็มบวกที่ไม่ซ้ำกัน
  const isValid =
    Array.isArray(genre_ids) &&
    genre_ids.every((id) => Number.isInteger(id) && id > 0) &&
    new Set(genre_ids).size === genre_ids.length;

  if (!isValid) {
    return sendError(res, 400, "VALIDATION_ERROR", "genre_ids ต้องเป็น array ของ ID จำนวนเต็มบวกที่ไม่ซ้ำกัน");
  }

  let connection;

  try {
    if (!(await findMovie(movieId))) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลภาพยนตร์");
    }

    if (genre_ids.length > 0) {
      const [genres] = await pool.query("SELECT id FROM genres WHERE id IN (?)", [genre_ids]);

      if (genres.length !== genre_ids.length) {
        return sendError(res, 400, "INVALID_GENRE_IDS", "มี ID ประเภทภาพยนตร์ที่ไม่มีอยู่ในระบบ");
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query("DELETE FROM movie_genres WHERE movie_id = ?", [movieId]);

    if (genre_ids.length > 0) {
      const values = genre_ids.map((genreId) => [movieId, genreId]);
      await connection.query("INSERT INTO movie_genres (movie_id, genre_id) VALUES ?", [values]);
    }

    await connection.commit();

    res.status(200).json({ message: "กำหนดประเภทภาพยนตร์สำเร็จ", movie_id: movieId, genre_ids });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally {
    if (connection) connection.release();
  }
});

// =============
// External API
// =============

// GET /api/v1/external/movies?title=Inception
// ค้นหาข้อมูลภาพยนตร์จาก OMDb (ดูรายละเอียด Retry / Timeout / Fallback ใน services/external-api.js)
// ตอบกลับ: 200 { source: "omdb" | "fallback", message, data } หรือ 400 ถ้าไม่ระบุ title
app.get("/api/v1/external/movies", async (req, res, next) => {
  try {
    const { title } = req.query;

    if (typeof title !== "string" || !title.trim()) {
      return sendError(res, 400, "VALIDATION_ERROR", "ระบุชื่อภาพยนตร์ผ่าน query parameter title");
    }

    res.status(200).json(await searchExternalMovie(title.trim()));
  } catch (err) {
    next(err);
  }
});

// ไม่พบเส้นทางที่ร้องขอ
app.use((req, res) => {
  sendError(res, 404, "ROUTE_NOT_FOUND", "ไม่พบเส้นทางที่ร้องขอ");
});

// Error ที่ไม่ได้คาดไว้ (เช่น ต่อฐานข้อมูลไม่ได้) จะมาจบที่นี่
app.use((err, req, res, next) => {
  console.error(err);
  sendError(res, 500, "INTERNAL_SERVER_ERROR", "เกิดข้อผิดพลาดภายในระบบ");
});

// เปิด Server เฉพาะตอนรัน index.js โดยตรง (ตอน Jest require ไฟล์นี้จะไม่เปิด Port)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server กำลังทำงานที่ http://localhost:${PORT}`);
  });
}

// ส่ง Express app ออกไปให้ Jest / Supertest นำไปทดสอบ
module.exports = app;
