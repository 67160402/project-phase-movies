require("dotenv").config(); // โหลดค่าจากไฟล์ .env มาใช้ (เช่น PORT, DB_HOST)

const express = require("express"); // เรียกใช้ Express เอาไว้สร้างเว็บเซิร์ฟเวอร์/API
const path = require("path"); // เครื่องมือจัดการที่อยู่ไฟล์/โฟลเดอร์
const pool = require("../db"); // ตัวเชื่อมต่อฐานข้อมูล MySQL (มาจากไฟล์ db.js)

const swaggerUi = require("swagger-ui-express"); // ทำหน้าเว็บเอกสาร API (Swagger)
const YAML = require("yamljs"); // อ่านไฟล์ .yaml (ใช้อ่าน openapi.yaml)
const { searchExternalMovie } = require("./services/external-api"); // ฟังก์ชันค้นหาหนังจาก OMDb (API ภายนอก)

// ฟังก์ชันช่วยจัดการหน้า (page), การเรียงลำดับ (sort), และคำค้นหา (search)
const { parsePagination, parseSort, parseSearch } = require("./middleware/query-parser");

// ตัวจำกัดจำนวนครั้งที่เรียก API กันคนยิงรัว ๆ
const { generalLimiter } = require("./middleware/rateLimiter");

const app = express(); // สร้างแอป Express
const PORT = process.env.PORT || 3000; // ใช้พอร์ตจาก .env ถ้าไม่มีใช้ 3000

app.use(express.json()); // ให้อ่านข้อมูลที่ส่งมาเป็น JSON ได้ (req.body)

// ใช้ตัวจำกัดจำนวนครั้งกับทุกเส้นทางที่ขึ้นต้นด้วย /api/v1
app.use("/api/v1", generalLimiter);

// ถ้าไม่ใช่โหมด production ให้เปิดหน้าเอกสาร API
if (process.env.NODE_ENV !== "production") {
  const swaggerDocument = YAML.load("./openapi.yaml"); // อ่านไฟล์ openapi.yaml
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument)); // เปิดดูได้ที่ /api-docs
}

// ให้เปิดไฟล์หน้าเว็บในโฟลเดอร์ frontend (เข้า localhost:3000 แล้วได้ index.html)
app.use(express.static(path.join(__dirname, "../frontend")));

// ===============
// ฟังก์ชันช่วยเหลือ
// ===============

// ส่ง error กลับไปในรูปแบบเดียวกันทุกที่: { error: { code, message } }
function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

// เช็คว่าข้อมูลหนังที่ส่งมาถูกต้องไหม (ใช้ตอนเพิ่มและแก้ไข)
function isValidMovie({ title, director, release_year }) {
  return (
    typeof title === "string" && // title ต้องเป็นข้อความ
    title.trim() !== "" && // และต้องไม่ว่าง
    typeof director === "string" && // director ต้องเป็นข้อความ
    director.trim() !== "" && // และต้องไม่ว่าง
    Number.isInteger(release_year) && // ปีต้องเป็นจำนวนเต็ม
    release_year > 0 // และมากกว่า 0
  );
}

// ดึงหนัง 1 เรื่องจาก id ถ้าไม่เจอจะได้ undefined
async function findMovie(id) {
  const [rows] = await pool.query("SELECT id, title, director, release_year FROM movies WHERE id = ?", [id]); // ค้นใน DB
  return rows[0]; // เอาแถวแรก (ถ้ามี)
}

// =========
// Movies
// =========

// GET /api/v1/movies : ดึงรายการหนังทั้งหมด (แบ่งหน้า + ค้นหา + เรียงลำดับ)
app.get("/api/v1/movies", parsePagination, parseSort, parseSearch, async (req, res, next) => {
  try {
    const { page, limit, offset } = req.pagination; // หน้าที่เท่าไร, ต่อหน้ากี่เรื่อง, ข้ามกี่เรื่อง
    const { field, order } = req.sort; // เรียงตามคอลัมน์ไหน, มากไปน้อยหรือน้อยไปมาก
    const { q } = req.search; // คำที่ค้นหา

    // ถ้ามีคำค้น ให้ค้นจากชื่อหนังหรือชื่อผู้กำกับ
    const where = q ? "WHERE title LIKE ? OR director LIKE ?" : "";
    const params = q ? [`%${q}%`, `%${q}%`] : []; // %คำค้น% = มีคำนี้อยู่ตรงไหนก็ได้

    // ดึงหนังตามเงื่อนไข เรียงลำดับ และตัดเอาเฉพาะหน้านี้ (LIMIT/OFFSET)
    const [rows] = await pool.query(
      `SELECT id, title, director, release_year FROM movies ${where}
       ORDER BY ${field} ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    // นับจำนวนหนังทั้งหมด เอาไปคำนวณจำนวนหน้า
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM movies ${where}`, params);

    // ส่งผลลัพธ์กลับ พร้อมข้อมูลหน้า
    res.status(200).json({
      message: "สำเร็จ",
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, // ปัดเศษขึ้นเป็นจำนวนหน้า
    });
  } catch (err) {
    next(err); // ถ้าพัง ส่งต่อให้ตัวจัดการ error ด้านล่าง
  }
});

// GET /api/v1/movies/:id : ดึงหนัง 1 เรื่องตาม id
app.get("/api/v1/movies/:id", async (req, res, next) => {
  try {
    const movie = await findMovie(req.params.id); // หาหนังจาก id ใน URL

    if (!movie) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลภาพยนตร์"); // ไม่เจอ ตอบ 404
    }

    res.status(200).json({ message: "สำเร็จ", data: movie }); // เจอ ส่งข้อมูลกลับ
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/movies : เพิ่มหนังใหม่
app.post("/api/v1/movies", async (req, res, next) => {
  try {
    // เช็คข้อมูลที่ส่งมา ถ้าไม่ถูกต้องตอบ 400
    if (!isValidMovie(req.body)) {
      return sendError(res, 400, "VALIDATION_ERROR", "กรุณาระบุ title, director และ release_year ให้ถูกต้อง");
    }

    const { title, director, release_year } = req.body; // แกะค่าออกจาก body

    // เพิ่มข้อมูลลงตาราง movies (trim = ตัดช่องว่างหัวท้าย)
    const [result] = await pool.query("INSERT INTO movies (title, director, release_year) VALUES (?, ?, ?)", [
      title.trim(),
      director.trim(),
      release_year,
    ]);

    // ตอบ 201 (สร้างสำเร็จ) พร้อมหนังที่เพิ่งเพิ่ม (insertId = id ที่ DB สร้างให้)
    res.status(201).json({ message: "เพิ่มภาพยนตร์สำเร็จ", data: await findMovie(result.insertId) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/movies/:id : แก้ไขหนัง (ต้องส่งข้อมูลครบทุกช่อง)
app.put("/api/v1/movies/:id", async (req, res, next) => {
  try {
    // เช็คข้อมูลก่อน ถ้าไม่ถูกต้องตอบ 400
    if (!isValidMovie(req.body)) {
      return sendError(res, 400, "VALIDATION_ERROR", "กรุณาระบุ title, director และ release_year ให้ถูกต้อง");
    }

    const { title, director, release_year } = req.body; // แกะค่าออกจาก body

    // แก้ข้อมูลหนังที่ id ตรงกัน
    const [result] = await pool.query("UPDATE movies SET title = ?, director = ?, release_year = ? WHERE id = ?", [
      title.trim(),
      director.trim(),
      release_year,
      req.params.id,
    ]);

    // ถ้าไม่มีแถวไหนถูกแก้ แปลว่าไม่มี id นี้
    if (result.affectedRows === 0) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลภาพยนตร์");
    }

    // ส่งข้อมูลหนังที่แก้แล้วกลับไป
    res.status(200).json({ message: "แก้ไขภาพยนตร์สำเร็จ", data: await findMovie(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/movies/:id : ลบหนัง
app.delete("/api/v1/movies/:id", async (req, res, next) => {
  try {
    const [result] = await pool.query("DELETE FROM movies WHERE id = ?", [req.params.id]); // ลบตาม id

    // ถ้าไม่มีแถวไหนถูกลบ แปลว่าไม่มี id นี้
    if (result.affectedRows === 0) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลภาพยนตร์");
    }

    // ข้อมูลใน movie_genres ของหนังเรื่องนี้ถูกลบตามอัตโนมัติ (ON DELETE CASCADE)
    res.status(200).json({ message: "ลบภาพยนตร์สำเร็จ" });
  } catch (err) {
    next(err);
  }
});

// =========
// Genres
// =========

// GET /api/v1/genres : ดึงประเภทหนังทั้งหมด
app.get("/api/v1/genres", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT id, name FROM genres ORDER BY id"); // ดึงทั้งหมด เรียงตาม id

    res.status(200).json({ message: "สำเร็จ", data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/genres : เพิ่มประเภทหนังใหม่
app.post("/api/v1/genres", async (req, res, next) => {
  try {
    const { name } = req.body; // ชื่อประเภทที่ส่งมา

    // ต้องเป็นข้อความและไม่ว่าง
    if (typeof name !== "string" || !name.trim()) {
      return sendError(res, 400, "VALIDATION_ERROR", "กรุณาระบุชื่อประเภทภาพยนตร์");
    }

    const [result] = await pool.query("INSERT INTO genres (name) VALUES (?)", [name.trim()]); // เพิ่มลง DB

    // ตอบ 201 พร้อม id ใหม่กับชื่อ
    res.status(201).json({
      message: "เพิ่มประเภทภาพยนตร์สำเร็จ",
      data: { id: result.insertId, name: name.trim() },
    });
  } catch (err) {
    // คอลัมน์ name เป็น UNIQUE ถ้าชื่อซ้ำ MySQL จะส่ง ER_DUP_ENTRY มา
    if (err.code === "ER_DUP_ENTRY") {
      return sendError(res, 409, "DUPLICATE_GENRE", "มีประเภทภาพยนตร์นี้อยู่แล้ว");
    }

    next(err); // error อื่น ส่งต่อให้ตัวจัดการ error
  }
});

// ==============
// Movie ↔ Genre
// ==============

// GET /api/v1/movies/:id/genres : ดูว่าหนังเรื่องนี้มีประเภทอะไรบ้าง
app.get("/api/v1/movies/:id/genres", async (req, res, next) => {
  try {
    // ถ้าไม่มีหนังเรื่องนี้ ตอบ 404
    if (!(await findMovie(req.params.id))) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลภาพยนตร์");
    }

    // JOIN ตาราง genres กับ movie_genres เพื่อหาชื่อประเภทของหนังเรื่องนี้
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

// PUT /api/v1/movies/:id/genres : กำหนดประเภทให้หนัง (แทนที่ของเดิมทั้งหมด)
app.put("/api/v1/movies/:id/genres", async (req, res, next) => {
  const { genre_ids } = req.body; // รายการ id ของประเภท เช่น [1, 3]
  const movieId = Number(req.params.id); // แปลง id ใน URL เป็นตัวเลข

  // ต้องเป็น array ของจำนวนเต็มบวกที่ไม่ซ้ำกัน
  const isValid =
    Array.isArray(genre_ids) && // เป็น array
    genre_ids.every((id) => Number.isInteger(id) && id > 0) && // ทุกตัวเป็นจำนวนเต็มบวก
    new Set(genre_ids).size === genre_ids.length; // ไม่มีค่าซ้ำ

  if (!isValid) {
    return sendError(res, 400, "VALIDATION_ERROR", "genre_ids ต้องเป็น array ของ ID จำนวนเต็มบวกที่ไม่ซ้ำกัน");
  }

  let connection; // เก็บการเชื่อมต่อที่ใช้ทำ transaction

  try {
    // ต้องมีหนังเรื่องนี้อยู่จริง
    if (!(await findMovie(movieId))) {
      return sendError(res, 404, "NOT_FOUND", "ไม่พบข้อมูลภาพยนตร์");
    }

    // ถ้าส่ง id ประเภทมา ต้องเช็คว่าทุกตัวมีอยู่จริงใน DB
    if (genre_ids.length > 0) {
      const [genres] = await pool.query("SELECT id FROM genres WHERE id IN (?)", [genre_ids]);

      // จำนวนที่เจอไม่เท่ากับที่ส่งมา แปลว่ามี id ที่ไม่มีอยู่จริง
      if (genres.length !== genre_ids.length) {
        return sendError(res, 400, "INVALID_GENRE_IDS", "มี ID ประเภทภาพยนตร์ที่ไม่มีอยู่ในระบบ");
      }
    }

    connection = await pool.getConnection(); // ขอการเชื่อมต่อจาก pool
    await connection.beginTransaction(); // เริ่ม transaction (สำเร็จหมดหรือไม่เปลี่ยนเลย)

    await connection.query("DELETE FROM movie_genres WHERE movie_id = ?", [movieId]); // ลบประเภทเดิมทั้งหมด

    // เพิ่มประเภทใหม่ทีเดียวทุกตัว
    if (genre_ids.length > 0) {
      const values = genre_ids.map((genreId) => [movieId, genreId]); // ทำเป็นคู่ [หนัง, ประเภท]
      await connection.query("INSERT INTO movie_genres (movie_id, genre_id) VALUES ?", [values]);
    }

    await connection.commit(); // ยืนยันการเปลี่ยนแปลง

    res.status(200).json({ message: "กำหนดประเภทภาพยนตร์สำเร็จ", movie_id: movieId, genre_ids });
  } catch (err) {
    if (connection) await connection.rollback(); // พังกลางทาง ย้อนกลับทุกอย่าง
    next(err);
  } finally {
    if (connection) connection.release(); // คืนการเชื่อมต่อให้ pool ไม่ว่าสำเร็จหรือพัง
  }
});

// =============
// External API
// =============

// GET /api/v1/external/movies?title=Inception : ค้นหาหนังจาก OMDb
app.get("/api/v1/external/movies", async (req, res, next) => {
  try {
    const { title } = req.query; // ชื่อหนังจาก URL (?title=...)

    // ต้องส่งชื่อมา และไม่ว่าง
    if (typeof title !== "string" || !title.trim()) {
      return sendError(res, 400, "VALIDATION_ERROR", "ระบุชื่อภาพยนตร์ผ่าน query parameter title");
    }

    // เรียกฟังก์ชันค้นหา (มี retry / timeout / fallback อยู่ใน external-api.js) แล้วส่งผลกลับ
    res.status(200).json(await searchExternalMovie(title.trim()));
  } catch (err) {
    next(err);
  }
});

// ถ้าไม่ตรงกับเส้นทางไหนข้างบนเลย ตอบ 404
app.use((req, res) => {
  sendError(res, 404, "ROUTE_NOT_FOUND", "ไม่พบเส้นทางที่ร้องขอ");
});

// ตัวจัดการ error กลาง: error ที่ไม่ได้คาดไว้ (เช่น ต่อ DB ไม่ได้) จะมาจบที่นี่
app.use((err, req, res, next) => {
  console.error(err); // แสดง error ใน terminal
  sendError(res, 500, "INTERNAL_SERVER_ERROR", "เกิดข้อผิดพลาดภายในระบบ"); // ตอบ 500
});

// เปิดเซิร์ฟเวอร์เฉพาะตอนรันไฟล์นี้โดยตรง (ตอน Jest เทสจะไม่เปิดพอร์ต)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server กำลังทำงานที่ http://localhost:${PORT}`); // บอกว่าเซิร์ฟเวอร์เริ่มแล้ว
  });
}

// ส่ง app ออกไปให้ไฟล์เทส (Jest / Supertest) เอาไปใช้
module.exports = app;
