require("dotenv").config();

const express = require("express");
const pool = require("./db");

const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const { searchExternalMovie } = require("./services/external-api");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// เอกสาร API ด้วย Swagger UI // Load Swagger documentation
const swaggerDocument = YAML.load("./openapi.yaml");

// ป้องกัน /api-docs ใน Production
if (process.env.NODE_ENV !== "production") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// ตรวจสอบการทำงานของ API
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Movie API พร้อมใช้งานแล้ว",
  });
});

// GET รายการภาพยนตร์ทั้งหมด
app.get("/api/v1/movies", async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, title, director, release_year
      FROM movies
      ORDER BY id
    `);

    res.status(200).json({
      message: "สำเร็จ",
      data: rows,
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
app.post("/api/v1/movies", async (req, res, next) => {
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
app.put("/api/v1/movies/:id", async (req, res, next) => {
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

    const [existing] = await pool.query("SELECT id FROM movies WHERE id = ?", [
      req.params.id,
    ]);

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
app.delete("/api/v1/movies/:id", async (req, res, next) => {
  try {
    const [result] = await pool.query("DELETE FROM movies WHERE id = ?", [
      req.params.id,
    ]);

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
app.post("/api/v1/genres", async (req, res, next) => {
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

    const [result] = await pool.query("INSERT INTO genres (name) VALUES (?)", [
      genreName,
    ]);

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
    const [movies] = await pool.query("SELECT id FROM movies WHERE id = ?", [
      req.params.id,
    ]);

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
app.put("/api/v1/movies/:id/genres", async (req, res, next) => {
  let connection;

  try {
    const { genre_ids } = req.body;

    if (
      !Array.isArray(genre_ids) ||
      !genre_ids.every((id) => Number.isInteger(id) && id > 0) ||
      new Set(genre_ids).size !== genre_ids.length
    ) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "genre_ids ต้องเป็น array ของ ID จำนวนเต็มบวกที่ไม่ซ้ำกัน",
        },
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [movies] = await connection.query(
      "SELECT id FROM movies WHERE id = ?",
      [req.params.id],
    );

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
      const [genres] = await connection.query(
        "SELECT id FROM genres WHERE id IN (?)",
        [genre_ids],
      );

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

    await connection.query("DELETE FROM movie_genres WHERE movie_id = ?", [
      req.params.id,
    ]);

    if (genre_ids.length > 0) {
      const values = genre_ids.map((genreId) => [
        Number(req.params.id),
        genreId,
      ]);

      await connection.query(
        "INSERT INTO movie_genres (movie_id, genre_id) VALUES ?",
        [values],
      );
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
