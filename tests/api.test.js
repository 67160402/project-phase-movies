// Mock service ของ External API เพื่อไม่ให้ Test ยิง OMDb จริง (Logic ภายในทดสอบแยกใน external-api.test.js)
jest.mock("../src/services/external-api");

const request = require("supertest");
const app = require("../src/index");
const pool = require("../db");
const { searchExternalMovie } = require("../src/services/external-api");

// ปิด Connection ของฐานข้อมูลหลังทดสอบเสร็จ เพื่อให้ Jest จบการทำงานได้
afterAll(() => pool.end());

describe("Movie API - Basic Tests", () => {
  test("GET / ควรตอบกลับสถานะ 200 และเปิดหน้า Frontend", async () => {
    const response = await request(app).get("/");

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/html/);
  });

  test("เส้นทางที่ไม่มีอยู่ควรตอบ 404", async () => {
    const response = await request(app).get("/api/v1/unknown");

    expect(response.statusCode).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
  });
});

describe("Movie API Tests", () => {
  let movieId;

  test("GET /api/v1/movies ควรดึงรายการภาพยนตร์พร้อม Pagination", async () => {
    const response = await request(app).get("/api/v1/movies?page=1&limit=2&sort=title&order=desc");

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeLessThanOrEqual(2);
    expect(response.body.pagination).toMatchObject({ page: 1, limit: 2 });
  });

  test("GET /api/v1/movies?q= ควรค้นหาจากชื่อหนังหรือผู้กำกับ", async () => {
    const response = await request(app).get("/api/v1/movies?q=Nolan");

    expect(response.statusCode).toBe(200);
    response.body.data.forEach((movie) => {
      expect(`${movie.title} ${movie.director}`).toMatch(/Nolan/i);
    });
  });

  test("POST /api/v1/movies ควรเพิ่มภาพยนตร์สำเร็จ", async () => {
    const response = await request(app).post("/api/v1/movies").send({
      title: "Jest Movie",
      director: "Jest Director",
      release_year: 2025,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body.data).toHaveProperty("id");

    movieId = response.body.data.id;
  });

  test("POST /api/v1/movies ถ้าข้อมูลไม่ครบควรตอบ 400", async () => {
    const response = await request(app).post("/api/v1/movies").send({ title: "No Director" });

    expect(response.statusCode).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("GET /api/v1/movies/:id ควรดึงข้อมูลภาพยนตร์ตาม ID สำเร็จ", async () => {
    const response = await request(app).get(`/api/v1/movies/${movieId}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.title).toBe("Jest Movie");
  });

  test("PUT /api/v1/movies/:id ควรแก้ไขภาพยนตร์สำเร็จ", async () => {
    const response = await request(app).put(`/api/v1/movies/${movieId}`).send({
      title: "Jest Movie Updated",
      director: "Jest Director",
      release_year: 2026,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.title).toBe("Jest Movie Updated");
  });

  test("PUT /api/v1/movies/:id ถ้าไม่พบภาพยนตร์ควรตอบ 404", async () => {
    const response = await request(app).put("/api/v1/movies/999999").send({
      title: "Missing",
      director: "Missing",
      release_year: 2025,
    });

    expect(response.statusCode).toBe(404);
  });

  test("PUT /api/v1/movies/:id ถ้า release_year ไม่ใช่ตัวเลขควรตอบ 400", async () => {
    const response = await request(app).put(`/api/v1/movies/${movieId}`).send({
      title: "Jest Movie",
      director: "Jest Director",
      release_year: "2026",
    });

    expect(response.statusCode).toBe(400);
  });

  test("DELETE /api/v1/movies/:id ควรลบภาพยนตร์สำเร็จ", async () => {
    const response = await request(app).delete(`/api/v1/movies/${movieId}`);

    expect(response.statusCode).toBe(200);
  });

  test("GET /api/v1/movies/:id ถ้าไม่พบภาพยนตร์ควรตอบ 404", async () => {
    const response = await request(app).get(`/api/v1/movies/${movieId}`);

    expect(response.statusCode).toBe(404);
  });

  test("DELETE /api/v1/movies/:id ถ้าไม่พบภาพยนตร์ควรตอบ 404", async () => {
    const response = await request(app).delete(`/api/v1/movies/${movieId}`);

    expect(response.statusCode).toBe(404);
  });
});

describe("Genre API Tests", () => {
  const genreName = `Jest Genre ${Date.now()}`;

  test("GET /api/v1/genres ควรดึงรายการประเภทภาพยนตร์สำเร็จ", async () => {
    const response = await request(app).get("/api/v1/genres");

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test("POST /api/v1/genres ควรเพิ่มประเภทภาพยนตร์สำเร็จ", async () => {
    const response = await request(app).post("/api/v1/genres").send({ name: genreName });

    expect(response.statusCode).toBe(201);
    expect(response.body.data.name).toBe(genreName);
  });

  test("POST /api/v1/genres ถ้าชื่อซ้ำควรตอบ 409", async () => {
    const response = await request(app).post("/api/v1/genres").send({ name: genreName });

    expect(response.statusCode).toBe(409);
  });

  test("POST /api/v1/genres ถ้าไม่ระบุชื่อควรตอบ 400", async () => {
    const response = await request(app).post("/api/v1/genres").send({});

    expect(response.statusCode).toBe(400);
  });
});

describe("Movie Genre Relationship Tests", () => {
  let movieId;
  let genreId;

  beforeAll(async () => {
    const movie = await request(app).post("/api/v1/movies").send({
      title: "Jest Genre Movie",
      director: "Jest Director",
      release_year: 2025,
    });
    movieId = movie.body.data.id;

    const genre = await request(app).post("/api/v1/genres").send({ name: `Jest Relation ${Date.now()}` });
    genreId = genre.body.data.id;
  });

  afterAll(async () => {
    await request(app).delete(`/api/v1/movies/${movieId}`);
  });

  test("PUT /api/v1/movies/:id/genres ควรกำหนดประเภทให้ภาพยนตร์สำเร็จ", async () => {
    const response = await request(app).put(`/api/v1/movies/${movieId}/genres`).send({ genre_ids: [genreId] });

    expect(response.statusCode).toBe(200);
    expect(response.body.genre_ids).toEqual([genreId]);
  });

  test("GET /api/v1/movies/:id/genres ควรดึงประเภทของภาพยนตร์ได้", async () => {
    const response = await request(app).get(`/api/v1/movies/${movieId}/genres`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.map((genre) => genre.id)).toEqual([genreId]);
  });

  test("PUT /api/v1/movies/:id/genres ถ้า genre_ids ไม่ใช่ Array ควรตอบ 400", async () => {
    const response = await request(app).put(`/api/v1/movies/${movieId}/genres`).send({ genre_ids: "1" });

    expect(response.statusCode).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("PUT /api/v1/movies/:id/genres ถ้ามี Genre ID ที่ไม่มีอยู่ควรตอบ 400", async () => {
    const response = await request(app).put(`/api/v1/movies/${movieId}/genres`).send({ genre_ids: [999999] });

    expect(response.statusCode).toBe(400);
    expect(response.body.error.code).toBe("INVALID_GENRE_IDS");
  });

  test("GET /api/v1/movies/:id/genres ถ้าไม่พบภาพยนตร์ควรตอบ 404", async () => {
    const response = await request(app).get("/api/v1/movies/999999/genres");

    expect(response.statusCode).toBe(404);
  });

  test("PUT /api/v1/movies/:id/genres ถ้าไม่พบภาพยนตร์ควรตอบ 404", async () => {
    const response = await request(app).put("/api/v1/movies/999999/genres").send({ genre_ids: [genreId] });

    expect(response.statusCode).toBe(404);
  });
});

describe("External Movie Endpoint Tests", () => {
  test("GET /api/v1/external/movies ถ้าไม่ระบุ title ควรตอบ 400", async () => {
    const response = await request(app).get("/api/v1/external/movies");

    expect(response.statusCode).toBe(400);
    expect(searchExternalMovie).not.toHaveBeenCalled();
  });

  test("GET /api/v1/external/movies ควรส่งผลลัพธ์จาก Service กลับไป", async () => {
    searchExternalMovie.mockResolvedValueOnce({ source: "fallback", message: "ข้อมูลสำรอง", data: { Title: "Inception" } });

    const response = await request(app).get("/api/v1/external/movies?title=%20Inception%20");

    expect(response.statusCode).toBe(200);
    expect(response.body.source).toBe("fallback");
    expect(searchExternalMovie).toHaveBeenCalledWith("Inception");
  });
});

describe("Error Handler Tests", () => {
  test("ถ้าฐานข้อมูลผิดพลาดควรตอบ 500 โดยไม่เปิดเผยรายละเอียด Error", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(pool, "query").mockRejectedValueOnce(new Error("Database is down"));

    const response = await request(app).get("/api/v1/movies");

    expect(response.statusCode).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(response.body)).not.toMatch(/Database is down/);

    jest.restoreAllMocks();
  });
});
