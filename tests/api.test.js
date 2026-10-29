const request = require("supertest");
const app = require("../index");

// เก็บ Token ที่สร้างจากชุด RBAC ไว้ใช้ร่วมกับ Test ชุดอื่น
// เพื่อไม่ให้การทดสอบ Login ซ้ำจนชน Rate Limiter
let sharedUserToken;
let sharedAdminToken;

describe("Movie API - Basic Tests", () => {
  test("GET / ควรตอบกลับสถานะ 200 และเปิดหน้า Frontend", async () => {
    const response = await request(app).get("/");

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/html/);
  });
});

describe("Authentication Tests", () => {
  let token;
  const testEmail = `jest-${Date.now()}@movie.com`;
  const testPassword = "Test1234";

  test("POST /api/v1/auth/register ควรสมัครสมาชิกสำเร็จ", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      email: testEmail,
      password: testPassword,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("message");
  });

  test("POST /api/v1/auth/login ควรเข้าสู่ระบบสำเร็จและได้รับ JWT", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: testEmail,
      password: testPassword,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("token");

    token = response.body.token;

    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  test("POST /api/v1/auth/login ถ้ารหัสผ่านผิดควรตอบ 401", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: testEmail,
      password: "WrongPassword123",
    });

    expect(response.statusCode).toBe(401);
  });

  test("GET /api/v1/auth/me ถ้าไม่มี Token ควรตอบ 401", async () => {
    const response = await request(app).get("/api/v1/auth/me");

    expect(response.statusCode).toBe(401);
  });

  test("GET /api/v1/auth/me ถ้า Token ไม่ถูกต้องควรตอบ 401", async () => {
    const response = await request(app).get("/api/v1/auth/me").set("Authorization", "Bearer invalid-token");

    expect(response.statusCode).toBe(401);
  });

  test("GET /api/v1/auth/me ถ้า Token ถูกต้องควรตอบ 200", async () => {
    const response = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);

    expect(response.statusCode).toBe(200);

    expect(response.body).toHaveProperty("data");

    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data).toHaveProperty("email");
    expect(response.body.data).toHaveProperty("role");
  });
});

describe("Movie API Tests", () => {
  test("GET /api/v1/movies ควรดึงรายการภาพยนตร์สำเร็จ", async () => {
    const response = await request(app).get("/api/v1/movies");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test("GET /api/v1/movies/:id ควรดึงข้อมูลภาพยนตร์ตาม ID สำเร็จ", async () => {
    const response = await request(app).get("/api/v1/movies/1");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("data");
  });

  test("GET /api/v1/movies/:id ถ้าไม่พบภาพยนตร์ควรตอบ 404", async () => {
    const response = await request(app).get("/api/v1/movies/999999");

    expect(response.statusCode).toBe(404);
  });
});

describe("Movie RBAC Tests", () => {
  let userToken;
  let adminToken;
  let createdMovieId;

  const userEmail = `jest-user-${Date.now()}@movie.com`;
  const adminEmail = `jest-admin-${Date.now()}@movie.com`;
  const password = "Test1234";

  test("สร้างบัญชี User สำหรับทดสอบ RBAC", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      email: userEmail,
      password,
    });

    expect(response.statusCode).toBe(201);
  });

  test("Login User ควรได้รับ JWT", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: userEmail,
      password,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("token");

    userToken = response.body.token;

    // เก็บ Token ไว้ใช้กับ Test ชุดอื่น
    sharedUserToken = userToken;
  });

  test("สร้างบัญชี Admin สำหรับทดสอบ RBAC", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      email: adminEmail,
      password,
    });

    expect(response.statusCode).toBe(201);

    const pool = require("../db");

    await pool.query("UPDATE users SET role = 'admin' WHERE email = ?", [adminEmail]);
  });

  test("Login Admin ควรได้รับ JWT", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: adminEmail,
      password,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("token");

    adminToken = response.body.token;

    // เก็บ Token ไว้ใช้กับ Test ชุดอื่น
    sharedAdminToken = adminToken;
  });

  test("POST /api/v1/movies ถ้าไม่มี Token ควรตอบ 401", async () => {
    const response = await request(app).post("/api/v1/movies").send({
      title: "Jest Unauthorized Movie",
      director: "Jest Test",
      release_year: 2026,
    });

    expect(response.statusCode).toBe(401);
  });

  test("POST /api/v1/movies ถ้าเป็น User ควรตอบ 403", async () => {
    const response = await request(app).post("/api/v1/movies").set("Authorization", `Bearer ${userToken}`).send({
      title: "Jest User Movie",
      director: "Jest Test",
      release_year: 2026,
    });

    expect(response.statusCode).toBe(403);
  });

  test("POST /api/v1/movies ถ้าเป็น Admin ควรสร้างภาพยนตร์สำเร็จ", async () => {
    const response = await request(app).post("/api/v1/movies").set("Authorization", `Bearer ${adminToken}`).send({
      title: "Jest Admin Movie",
      director: "Jest Test",
      release_year: 2026,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("data");

    createdMovieId = response.body.data.id;

    expect(createdMovieId).toBeDefined();
  });

  test("PUT /api/v1/movies/:id ถ้าเป็น Admin ควรแก้ไขภาพยนตร์สำเร็จ", async () => {
    const response = await request(app).put(`/api/v1/movies/${createdMovieId}`).set("Authorization", `Bearer ${adminToken}`).send({
      title: "Jest Admin Movie Updated",
      director: "Jest Test Updated",
      release_year: 2025,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("data");
  });

  test("DELETE /api/v1/movies/:id ถ้าเป็น Admin ควรลบภาพยนตร์สำเร็จ", async () => {
    const response = await request(app).delete(`/api/v1/movies/${createdMovieId}`).set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
  });
});

describe("Genre API Tests", () => {
  test("GET /api/v1/genres ควรดึงรายการประเภทภาพยนตร์สำเร็จ", async () => {
    const response = await request(app).get("/api/v1/genres");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test("POST /api/v1/genres ถ้าไม่มี Token ควรตอบ 401", async () => {
    const response = await request(app)
      .post("/api/v1/genres")
      .send({
        name: `Jest Genre ${Date.now()}`,
      });

    expect(response.statusCode).toBe(401);
  });

  test("POST /api/v1/genres ถ้าเป็น User ควรตอบ 403", async () => {
    // ใช้ User Token ที่สร้างไว้แล้วจาก Movie RBAC Tests
    // ไม่ Login ซ้ำ เพื่อป้องกัน Rate Limiter
    const response = await request(app)
      .post("/api/v1/genres")
      .set("Authorization", `Bearer ${sharedUserToken}`)
      .send({
        name: `Jest User Genre ${Date.now()}`,
      });

    expect(response.statusCode).toBe(403);
  });
});

describe("Movie Genre Relationship Tests", () => {
  let movieId;
  let genreId;

  test("สร้างภาพยนตร์สำหรับทดสอบ Movie Genre", async () => {
    // ใช้ Admin Token ที่สร้างไว้แล้วจาก Movie RBAC Tests
    // ไม่ Login Admin ซ้ำ
    const response = await request(app).post("/api/v1/movies").set("Authorization", `Bearer ${sharedAdminToken}`).send({
      title: "Jest Genre Movie",
      director: "Jest Genre Test",
      release_year: 2026,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("data");

    movieId = response.body.data.id;
  });

  test("POST /api/v1/genres ด้วย Admin ควรสร้างประเภทภาพยนตร์สำเร็จ", async () => {
    const response = await request(app)
      .post("/api/v1/genres")
      .set("Authorization", `Bearer ${sharedAdminToken}`)
      .send({
        name: `Jest Genre ${Date.now()}`,
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data).toHaveProperty("name");

    genreId = response.body.data.id;
  });

  test("PUT /api/v1/movies/:id/genres ควรกำหนดประเภทให้ภาพยนตร์สำเร็จ", async () => {
    const response = await request(app)
      .put(`/api/v1/movies/${movieId}/genres`)
      .set("Authorization", `Bearer ${sharedAdminToken}`)
      .send({
        genre_ids: [genreId],
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("movie_id");
    expect(response.body).toHaveProperty("genre_ids");
    expect(response.body.movie_id).toBe(movieId);
    expect(response.body.genre_ids).toEqual([genreId]);
  });

  test("GET /api/v1/movies/:id/genres ควรดึงประเภทของภาพยนตร์ได้", async () => {
    const response = await request(app).get(`/api/v1/movies/${movieId}/genres`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(Array.isArray(response.body.data)).toBe(true);

    expect(response.body.data.some((genre) => genre.id === genreId)).toBe(true);
  });

  test("PUT /api/v1/movies/:id/genres ถ้า genre_ids ไม่ใช่ Array ควรตอบ 400", async () => {
    const response = await request(app).put(`/api/v1/movies/${movieId}/genres`).set("Authorization", `Bearer ${sharedAdminToken}`).send({
      genre_ids: genreId,
    });

    expect(response.statusCode).toBe(400);
  });

  test("PUT /api/v1/movies/:id/genres ถ้ามี Genre ID ที่ไม่มีอยู่ควรตอบ 400", async () => {
    const response = await request(app)
      .put(`/api/v1/movies/${movieId}/genres`)
      .set("Authorization", `Bearer ${sharedAdminToken}`)
      .send({
        genre_ids: [999999],
      });

    expect(response.statusCode).toBe(400);
  });
});
