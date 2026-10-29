require("dotenv").config();

const express = require("express");
const path = require("path");
const pool = require("./db");

const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const { searchExternalMovie } = require("./services/external-api");

// Middleware สำหรับจัดการ Pagination, Sort และ Search
const { parsePagination, parseSort, parseSearch } = require("./middleware/query-parser");

// เครื่องมือสำหรับจัดการ Password และสร้าง Token
const { hashPassword, verifyPassword, generateToken } = require("./auth-helpers");

// Middleware สำหรับตรวจสอบ Token และตรวจสอบ Role ของผู้ใช้
const { authenticateToken, authorizeRole } = require("./middleware/auth");

// Middleware สำหรับป้องกันการเรียก API มากเกินไป (Rate Limiter)
const { authLimiter, generalLimiter } = require("./middleware/rateLimiter");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// จำกัดจำนวน Request ที่เข้ามายัง API ทั่วไป
app.use("/api/v1", generalLimiter);

// เอกสาร API ด้วย Swagger UI // Load Swagger documentation
const swaggerDocument = YAML.load("./openapi.yaml");

// ป้องกัน /api-docs ใน Production
if (process.env.NODE_ENV !== "production") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// เปิด Frontend จากโฟลเดอร์ frontend ให้สามารถเข้าถึงได้ผ่าน URL
app.use(express.static(path.join(__dirname, "frontend")));

// ตรวจสอบการทำงานของ API
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Movie API พร้อมใช้งานแล้ว",
  });
});

// ======== Authentication ========
// สมัครสมาชิก
// Endpoint นี้ไม่ต้อง Login
// authLimiter เพื่อป้องกันการสมัครสมาชิกจำนวนมาก
app.post("/api/v1/auth/register", authLimiter, async (req, res, next) => {
  const { email, password } = req.body;

  // ตรวจสอบข้อมูลที่ Client ส่งมา
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password.trim()) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ email และ password",
      },
    });
  }

  try {
    // ลบช่องว่างด้านหน้าและด้านหลังของ Email
    const cleanEmail = email.trim();

    // ตรวจสอบว่า Email นี้มีอยู่ในระบบแล้วหรือยัง
    const [existingUsers] = await pool.query("SELECT id FROM users WHERE email = ?", [cleanEmail]);

    if (existingUsers.length > 0) {
      return res.status(409).json({
        error: {
          code: "DUPLICATE_EMAIL",
          message: "อีเมลนี้มีอยู่ในระบบแล้ว",
        },
      });
    }

    // Hash Password ก่อนจะบันทึกลง Database โดยไม่เก็บ Password จริงเพื่อความปลอดภัย
    const passwordHash = await hashPassword(password);

    // สมัครสมาชิกใหม่โดยกำหนด Role เริ่มต้นเป็น user
    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES (?, ?, 'user')`,
      [cleanEmail, passwordHash],
    );

    // ส่งข้อมูลที่จำเป็นกลับไป แต่ไม่ส่ง Password หรือ Hash กลับไป
    res.status(201).json({
      message: "สมัครสมาชิกสำเร็จ",
      data: {
        id: result.insertId,
        email: cleanEmail,
        role: "user",
      },
    });
  } catch (err) {
    next(err);
  }
});

// Login
// ผู้ใช้ส่ง Email และ Password เพื่อขอ Token
app.post("/api/v1/auth/login", authLimiter, async (req, res, next) => {
  const { email, password } = req.body;

  // ตรวจสอบข้อมูลที่ผู้ใช้ส่งมา
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password.trim()) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ email และ password",
      },
    });
  }

  try {
    // ค้นหาผู้ใช้จาก Email ที่ผู้ใช้กรอกเข้ามาใน Database
    const [rows] = await pool.query(
      `SELECT id, email, password_hash, role
       FROM users
       WHERE email = ?`,
      [email.trim()],
    );

    // หากไม่พบ Email ให้ตอบกลับด้วยข้อความเดียวกับกรณี Password ผิด
    if (rows.length === 0) {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        },
      });
    }

    const user = rows[0];

    // เปรียบเทียบ Password ที่ผู้ใช้กรอกกับ Password Hash ที่เก็บไว้ใน Database
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    // หาก Password ไม่ถูกต้อง ให้ตอบกลับด้วยข้อความเดียวกับกรณี Email ไม่พบ
    if (!isPasswordValid) {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        },
      });
    }

    // Login สำเร็จ และสร้าง Token ให้ผู้ใช้ โดยใส่ข้อมูลที่จำเป็น เช่น id, email และ role ของผู้ใช้
    const token = generateToken(user);

    // ส่ง Token ให้ผู้ใช้เพื่อนำไปใช้ในการเรียก API ที่ต้อง Login
    res.status(200).json({
      message: "เข้าสู่ระบบสำเร็จ",
      token,
    });
  } catch (err) {
    next(err);
  }
});

// ตรวจสอบข้อมูลผู้ใช้จาก Token
// Endpoint นี้ต้อง Login
app.get("/api/v1/auth/me", authenticateToken, (req, res) => {
  res.status(200).json({
    message: "สำเร็จ",
    data: req.user,
  });
});

// GET รายการภาพยนตร์ทั้งหมด
// รองรับ Pagination, Sort และ Search
app.get("/api/v1/movies", parsePagination, parseSort, parseSearch, async (req, res, next) => {
  try {
    // รับค่าจาก query-parser
    const { page, limit, offset } = req.pagination;
    const { field, order } = req.sort;
    const { q } = req.search;

    // สร้างเงื่อนไขสำหรับค้นหา
    const conditions = [];
    const params = [];

    // ถ้ามีคำค้น ให้ค้นจากชื่อหนังหรือชื่อผู้กำกับ
    if (q) {
      conditions.push("(title LIKE ? OR director LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }

    // สร้าง WHERE เฉพาะเมื่อมีเงื่อนไขค้นหา
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // ดึงข้อมูลตาม Pagination และ Sort
    // field และ order ผ่านการตรวจสอบจาก allowlist แล้ว
    const [rows] = await pool.query(
      `
        SELECT id, title, director, release_year
        FROM movies
        ${whereClause}
        ORDER BY ${field} ${order}
        LIMIT ? OFFSET ?
        `,
      [...params, limit, offset],
    );

    // นับจำนวนข้อมูลทั้งหมดที่ตรงกับคำค้น
    const [countRows] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM movies
        ${whereClause}
        `,
      params,
    );

    const total = countRows[0].total;

    // คำนวณจำนวนหน้าทั้งหมด
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      message: "สำเร็จ",
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET ภาพยนตร์ตาม ID
app.get("/api/v1/movies/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, director, release_year
       FROM movies WHERE id = ?`,
      [req.params.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบข้อมูลภาพยนตร์",
        },
      });
    }

    res.status(200).json({
      message: "สำเร็จ",
      data: rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// POST เพิ่มภาพยนตร์
// ต้อง Login และได้รับสิทธิ์เป็น Admin เท่านั้น
app.post("/api/v1/movies", authenticateToken, authorizeRole("admin"), async (req, res, next) => {
  try {
    const { title, director, release_year } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof director !== "string" ||
      !director.trim() ||
      !Number.isInteger(release_year) ||
      release_year < 1
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "กรุณาระบุ title, director และ release_year ให้ถูกต้อง",
        },
      });
    }

    const [result] = await pool.query(
      `INSERT INTO movies (title, director, release_year)
       VALUES (?, ?, ?)`,
      [title.trim(), director.trim(), release_year],
    );

    const [rows] = await pool.query(
      `SELECT id, title, director, release_year
       FROM movies WHERE id = ?`,
      [result.insertId],
    );

    res.status(201).json({
      message: "เพิ่มภาพยนตร์สำเร็จ",
      data: rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// PUT แก้ไขภาพยนตร์
// ต้อง Login และได้รับสิทธิ์เป็น Admin เท่านั้น
app.put("/api/v1/movies/:id", authenticateToken, authorizeRole("admin"), async (req, res, next) => {
  try {
    const { title, director, release_year } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof director !== "string" ||
      !director.trim() ||
      !Number.isInteger(release_year) ||
      release_year < 1
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "กรุณาระบุ title, director และ release_year ให้ถูกต้อง",
        },
      });
    }

    const [existing] = await pool.query("SELECT id FROM movies WHERE id = ?", [req.params.id]);

    if (existing.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบข้อมูลภาพยนตร์",
        },
      });
    }

    await pool.query(
      `UPDATE movies
       SET title = ?, director = ?, release_year = ?
       WHERE id = ?`,
      [title.trim(), director.trim(), release_year, req.params.id],
    );

    const [rows] = await pool.query(
      `SELECT id, title, director, release_year
       FROM movies WHERE id = ?`,
      [req.params.id],
    );

    res.status(200).json({
      message: "แก้ไขภาพยนตร์สำเร็จ",
      data: rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// DELETE ลบภาพยนตร์
// ต้อง Login และได้รับสิทธิ์เป็น Admin เท่านั้น
app.delete("/api/v1/movies/:id", authenticateToken, authorizeRole("admin"), async (req, res, next) => {
  try {
    const [result] = await pool.query("DELETE FROM movies WHERE id = ?", [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบข้อมูลภาพยนตร์",
        },
      });
    }

    res.status(200).json({
      message: "ลบภาพยนตร์สำเร็จ",
    });
  } catch (err) {
    next(err);
  }
});

// GET รายการประเภทภาพยนตร์ทั้งหมด
app.get("/api/v1/genres", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT id, name FROM genres ORDER BY id");

    res.status(200).json({
      message: "สำเร็จ",
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST เพิ่มประเภทภาพยนตร์
// ต้อง Login และได้รับสิทธิ์เป็น Admin เท่านั้น
app.post("/api/v1/genres", authenticateToken, authorizeRole("admin"), async (req, res, next) => {
  try {
    const { name } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "กรุณาระบุชื่อประเภทภาพยนตร์",
        },
      });
    }

    const genreName = name.trim();

    const [result] = await pool.query("INSERT INTO genres (name) VALUES (?)", [genreName]);

    res.status(201).json({
      message: "เพิ่มประเภทภาพยนตร์สำเร็จ",
      data: {
        id: result.insertId,
        name: genreName,
      },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "DUPLICATE_GENRE",
          message: "มีประเภทภาพยนตร์นี้อยู่แล้ว",
        },
      });
    }

    next(err);
  }
});

// GET ประเภทของภาพยนตร์ตาม ID
app.get("/api/v1/movies/:id/genres", async (req, res, next) => {
  try {
    const [movies] = await pool.query("SELECT id FROM movies WHERE id = ?", [req.params.id]);

    if (movies.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบข้อมูลภาพยนตร์",
        },
      });
    }

    const [rows] = await pool.query(
      `SELECT g.id, g.name
       FROM genres g
       JOIN movie_genres mg ON mg.genre_id = g.id
       WHERE mg.movie_id = ?
       ORDER BY g.id`,
      [req.params.id],
    );

    res.status(200).json({
      message: "สำเร็จ",
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// PUT กำหนดประเภทให้ภาพยนตร์
// ต้อง Login และได้รับสิทธิ์เป็น Admin เท่านั้น
app.put("/api/v1/movies/:id/genres", authenticateToken, authorizeRole("admin"), async (req, res, next) => {
  let connection;

  try {
    const { genre_ids } = req.body;

    if (!Array.isArray(genre_ids) || !genre_ids.every((id) => Number.isInteger(id) && id > 0) || new Set(genre_ids).size !== genre_ids.length) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "genre_ids ต้องเป็น array ของ ID จำนวนเต็มบวกที่ไม่ซ้ำกัน",
        },
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [movies] = await connection.query("SELECT id FROM movies WHERE id = ?", [req.params.id]);

    if (movies.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบข้อมูลภาพยนตร์",
        },
      });
    }

    if (genre_ids.length > 0) {
      const [genres] = await connection.query("SELECT id FROM genres WHERE id IN (?)", [genre_ids]);

      if (genres.length !== genre_ids.length) {
        await connection.rollback();

        return res.status(400).json({
          error: {
            code: "INVALID_GENRE_IDS",
            message: "มี ID ประเภทภาพยนตร์ที่ไม่มีอยู่ในระบบ",
          },
        });
      }
    }

    await connection.query("DELETE FROM movie_genres WHERE movie_id = ?", [req.params.id]);

    if (genre_ids.length > 0) {
      const values = genre_ids.map((genreId) => [Number(req.params.id), genreId]);

      await connection.query("INSERT INTO movie_genres (movie_id, genre_id) VALUES ?", [values]);
    }

    await connection.commit();

    res.status(200).json({
      message: "กำหนดประเภทภาพยนตร์สำเร็จ",
      movie_id: Number(req.params.id),
      genre_ids,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }

    next(err);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ค้นหาข้อมูลภาพยนตร์จาก External API
app.get("/api/v1/external/movies", async (req, res, next) => {
  try {
    const title = req.query.title;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "ระบุชื่อภาพยนตร์ผ่าน query parameter title",
        },
      });
    }

    const result = await searchExternalMovie(title.trim());

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// 404 Not Found
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "ไม่พบเส้นทางที่ร้องขอ",
    },
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "เกิดข้อผิดพลาดภายในระบบ",
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่ http://localhost:${PORT}`);
});
