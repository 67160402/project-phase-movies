# Test Coverage Report Baseline — Movies API

## 1. วิธีรัน

Test ของ API ต้องเชื่อมต่อ MySQL จริง จึงต้องเปิดฐานข้อมูลก่อน (ใช้ Docker ได้)

```bash
npm install
docker compose up -d --build
```

รัน Test พร้อม Coverage (MySQL ใน Docker เปิดพอร์ต 3307 ที่เครื่อง Host)

```bash
DB_HOST=127.0.0.1 DB_PORT=3307 DB_USER=root DB_PASSWORD=1234 DB_NAME=movie_api npx jest --coverage
```

รายงานแบบ HTML อยู่ที่ `coverage/lcov-report/index.html`

### เครื่องมือที่ใช้

- **Jest** สำหรับ Unit Test และ API Test
- **Supertest** สำหรับยิง HTTP Request เข้า Express app โดยไม่ต้องเปิด Port
- **jest.mock** สำหรับจำลอง `axios` และ External API Service เพื่อไม่ให้ Test ยิง OMDb จริง

---

## 2. ผลการรัน Test

```text
Test Suites: 2 passed, 2 total
Tests:       30 passed, 30 total
Snapshots:   0 total
Time:        3.299 s
Ran all test suites.
```

| Test Suite                   | จำนวน Test | ทดสอบอะไร                                                                                                                                               |
| ---------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/api.test.js`          |         26 | ทดสอบทุก Endpoint ผ่าน HTTP กับฐานข้อมูลจริง: Movies CRUD, ค้นหา/Pagination/Sort, Genres, Movie ↔ Genre, External endpoint, 404 และ Error Handler (500) |
| `tests/external-api.test.js` |          4 | Logic ภายใน `external-api.js`: สำเร็จ, ไม่พบภาพยนตร์, Retry + Fallback เมื่อล้มเหลว, Retry + Fallback เมื่อ Timeout                                     |
| **รวม**                      |     **30** | ผ่านทั้งหมด ไม่มี Test ที่ล้มเหลว                                                                                                                       |

---

## 3. ผล Test Coverage

```text
-------------------------------------|---------|----------|---------|---------|-------------------------------------------------
File                                 | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------------------------|---------|----------|---------|---------|-------------------------------------------------
All files                            |   92.09 |    87.95 |   95.83 |   92.39 |
 project-phase-movies                |     100 |       50 |     100 |     100 |
  db.js                              |     100 |       50 |     100 |     100 |
 project-phase-movies/src            |      90 |    87.71 |   94.44 |   90.55 |
  index.js                           |      90 |    87.71 |   94.44 |   90.55 | 114,139,169,186,203,231,258,311-312,335,352-353
 project-phase-movies/src/middleware |     100 |      100 |     100 |     100 |
  query-parser.js                    |     100 |      100 |     100 |     100 |
  rateLimiter.js                     |     100 |      100 |     100 |     100 |
 project-phase-movies/src/services   |   96.29 |    85.71 |     100 |   95.83 |
  external-api.js                    |   96.29 |    85.71 |     100 |   95.83 | 76
-------------------------------------|---------|----------|---------|---------|-------------------------------------------------
```

| ตัวชี้วัด      |   Coverage |
| -------------- | ---------: |
| **Statements** | **92.09%** |
| **Branches**   | **87.95%** |
| **Functions**  | **95.83%** |
| **Lines**      | **92.39%** |

---

## 4. สิ่งที่ Test ครอบคลุม

### Movies (`/api/v1/movies`)

- GET รายการพร้อม Pagination (`page`, `limit`) และ Sort (`sort`, `order`)
- ค้นหาด้วย `q` จากชื่อหนังหรือผู้กำกับ
- POST เพิ่มสำเร็จ (201) และข้อมูลไม่ครบ (400)
- GET ตาม ID สำเร็จ (200) และไม่พบ (404)
- PUT แก้ไขสำเร็จ (200), `release_year` เป็นข้อความ (400) และไม่พบ ID (404)
- DELETE ลบสำเร็จ (200) และไม่พบ ID (404)

### Genres (`/api/v1/genres`)

- GET รายการทั้งหมด
- POST เพิ่มสำเร็จ (201), ชื่อซ้ำ (409) และไม่ระบุชื่อ (400)

### Movie ↔ Genre (`/api/v1/movies/:id/genres`)

- PUT กำหนดประเภทสำเร็จ และ GET ได้ประเภทที่กำหนดไว้
- `genre_ids` ไม่ใช่ array (400), มี Genre ID ที่ไม่มีอยู่ (400)
- ภาพยนตร์ไม่มีอยู่ ทั้ง GET และ PUT (404)

### External API

- Endpoint: ไม่ระบุ `title` (400), ส่งผลจาก Service กลับไปและตัดช่องว่างของ `title` (200)
- Service: OMDb ตอบสำเร็จ, OMDb ไม่พบหนัง, Retry 3 ครั้งแล้ว Fallback เมื่อ Error และเมื่อ Timeout

### ระบบทั่วไป

- `GET /` เปิดหน้า Frontend
- Path ที่ไม่มีอยู่ (404 `ROUTE_NOT_FOUND`)
- ฐานข้อมูลผิดพลาด (500 `INTERNAL_SERVER_ERROR`) และไม่ส่งข้อความ Error ภายในออกไปให้ Client

---

## 5. จุดที่ยังไม่มี Test ครอบคลุม

| ไฟล์:บรรทัด                                  | โค้ด                                                                                             | เหตุผลที่ยังไม่ครอบคลุม                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `index.js:114, 139, 169, 186, 203, 258, 335` | `next(err)` ใน `catch` ของ GET/POST/PUT/DELETE movies, GET genres, GET movie genres และ External | Test จำลองฐานข้อมูลล่มเฉพาะ `GET /movies` (ครอบคลุม Error Handler กลางแล้ว) แต่ยังไม่ได้จำลองแยกทุก Endpoint |
| `index.js:231`                               | `next(err)` ใน POST genres กรณี Error ที่ไม่ใช่ชื่อซ้ำ                                           | ต้องจำลอง Database Error ชนิดอื่นที่ไม่ใช่ `ER_DUP_ENTRY`                                                    |
| `index.js:311-312`                           | `rollback()` ใน PUT movie genres                                                                 | ต้องทำให้ Query ภายใน Transaction ล้มกลางทาง ซึ่งยังไม่มี Test                                               |
| `index.js:352-353`                           | `app.listen(...)`                                                                                | ทำงานเฉพาะตอนรัน `node src/index.js` โดยตรง ตอน Test ใช้ Supertest จึงไม่ถูกเรียก (ตั้งใจ)                   |
| `external-api.js:76`                         | `return fallback` หลัง loop                                                                      | ไม่มีทางไปถึงได้จริง เพราะรอบสุดท้ายของ loop `return` ก่อนเสมอ เป็นบรรทัดกันพลาด                             |
| `db.js:5`                                    | `process.env.DB_PORT \|\| 3306`                                                                  | Test ส่ง `DB_PORT` ทุกครั้ง จึงไม่เข้า Branch ค่าเริ่มต้น                                                    |

ส่วนที่เสี่ยงที่สุดในรายการนี้คือ **Rollback ของ Transaction** (`index.js:311-312`) ถ้าจะเพิ่ม Test ควรเริ่มจากจุดนี้

---

## 6. ข้อจำกัดของ Test Coverage

Coverage นี้วัดเฉพาะโค้ด Backend ที่ Jest รัน ส่วนที่ไม่ได้อยู่ในตัวเลขนี้ ได้แก่

- Frontend (`frontend/`) ทดสอบด้วยการใช้งานจริงผ่าน Browser
- Rate Limiter ถูกโหลดและทำงานในทุก Request แต่ยังไม่มี Test ที่ยิงเกิน 100 ครั้งเพื่อตรวจ `429`
- การเชื่อมต่อ OMDb จริง (ใน Test ใช้ Mock ทั้งหมด)
- Postman Collection (`postman_collection.json`) รันแยกด้วย Postman CLI / Newman ผลล่าสุดผ่าน 30/30 assertions

---

## 7. สรุป

Baseline ของ Phase 3 คือ **30 Tests ผ่านทั้งหมด** และ Coverage รวม **92.09% Statements / 87.95% Branches / 95.83% Functions / 92.39% Lines**

ทุก Endpoint ใน `openapi.yaml` (10 Endpoint) มี Test ทั้งกรณีสำเร็จและกรณีผิดพลาดหลัก บรรทัดที่เหลือเป็น `catch` ของ Database Error รายตัว, Rollback ของ Transaction และโค้ดเปิด Server ซึ่งไม่ได้ทำงานระหว่าง Test
