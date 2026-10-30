# รายงาน Test Coverage Baseline — Movies API (Phase 3)

## 1. วิธีรัน

ติดตั้ง dependencies ของโปรเจกต์ก่อน:

```bash
npm install
```

รัน Test ทั้งหมด:

```bash
npm test
```

รัน Test พร้อมตรวจสอบ Test Coverage:

```bash
npm test -- --coverage
```

รายงาน Coverage แบบ HTML จะถูกสร้างไว้ในโฟลเดอร์:

```text
coverage/
└── lcov-report/
    └── index.html
```

สามารถเปิดไฟล์ `coverage/lcov-report/index.html` เพื่อดูรายละเอียด Coverage ของแต่ละไฟล์ได้

### เครื่องมือที่ใช้

- **Jest** สำหรับ Unit Test และ API Test
- **Supertest** สำหรับทดสอบ HTTP API
- Node.js เป็น Test Environment

---

## 2. ผลการรัน Test

ผลการรันล่าสุดหลังจากปรับโครงสร้างโปรเจกต์ให้ Backend อยู่ภายใน `src/`:

```text
Test Suites: 2 passed, 2 total
Tests:       32 passed, 32 total
Snapshots:   0 total
Time:        5.248 s
Ran all test suites.
```

### Test Suites

| Test Suite                   | จำนวน Test | ทดสอบอะไร                                                                                                                           |
| ---------------------------- | ---------: | ----------------------------------------------------------------------------------------------------------------------------------- |
| `tests/api.test.js`          |         28 | Authentication, JWT, Movie API, RBAC, Genre API และความสัมพันธ์ระหว่าง Movie กับ Genre                                              |
| `tests/external-api.test.js` |          4 | External Movie API ได้แก่ การเรียก API สำเร็จ, ไม่พบภาพยนตร์, Retry/Fallback เมื่อ API ล้มเหลว และ Retry/Fallback เมื่อเกิด Timeout |
| **รวม**                      |     **32** | **ทดสอบ API หลักและ External API**                                                                                                  |

ผลการทดสอบ:

- Test Suites ผ่านทั้งหมด **2/2**
- Tests ผ่านทั้งหมด **32/32**
- Tests ที่ไม่ผ่าน **0**
- Snapshots **0**

---

## 3. ผล Test Coverage

ผล Coverage จากการรันจริง:

```text
-------------------------------|---------|----------|---------|---------|-----------------------------------------------------------
File                           | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------------------|---------|----------|---------|---------|-----------------------------------------------------------
All files                      |   81.96 |     71.3 |   83.87 |   81.58 |
 project-phase3                |     100 |      100 |     100 |     100 |
  db.js                        |     100 |      100 |     100 |     100 |
 project-phase3/src            |   76.66 |    67.46 |   77.27 |    76.4 |
  auth-helpers.js              |     100 |       50 |     100 |     100 | 32
  index.js                     |   75.72 |     67.9 |   73.68 |   75.43 | ...32,164,192-193,238,265,283,308,326,337,363,374,386,400,411,431-440,450,472,499-501,540-544,554-570,576,586-588,599-600
 project-phase3/src/middleware |   97.05 |    77.77 |     100 |   97.05 |
  auth.js                      |   93.75 |     87.5 |     100 |   93.75 | 46
  query-parser.js              |     100 |       70 |     100 |     100 | 32-53
  rateLimiter.js               |     100 |      100 |     100 |     100 |
 project-phase3/src/services   |   96.29 |    85.71 |     100 |    95.83 |
  external-api.js              |   96.29 |    85.71 |     100 |    95.83 | 76
-------------------------------|---------|----------|---------|---------|-----------------------------------------------------------
```

### สรุปตัวชี้วัด

| ตัวชี้วัด      |   Coverage |
| -------------- | ---------: |
| **Statements** | **81.96%** |
| **Branches**   | **71.30%** |
| **Functions**  | **83.87%** |
| **Lines**      | **81.58%** |

Coverage รวมของ Backend อยู่ที่:

- **81.96% Statements**
- **71.30% Branches**
- **83.87% Functions**
- **81.58% Lines**

---

## 4. Coverage แยกตามส่วนของระบบ

### 4.1 Database

| ไฟล์    | Statements | Branches | Functions | Lines |
| ------- | ---------: | -------: | --------: | ----: |
| `db.js` |       100% |     100% |      100% |  100% |

`db.js` มี Coverage 100% จากการทำงานของระบบที่เรียกใช้ Database Connection Pool

---

### 4.2 Core API

| ไฟล์                  | Statements | Branches | Functions |  Lines |
| --------------------- | ---------: | -------: | --------: | -----: |
| `src/index.js`        |     75.72% |   67.90% |    73.68% | 75.43% |
| `src/auth-helpers.js` |       100% |      50% |      100% |   100% |

`src/index.js` เป็นไฟล์หลักของ API และมีจำนวน Logic มากที่สุด จึงมีบางกรณีที่ยังไม่ได้ถูกเรียกใช้โดย Test เช่น บาง Error Handler, Validation และบางเส้นทางของ API

---

### 4.3 Middleware

| ไฟล์                             | Statements | Branches | Functions |  Lines |
| -------------------------------- | ---------: | -------: | --------: | -----: |
| `src/middleware/auth.js`         |     93.75% |   87.50% |      100% | 93.75% |
| `src/middleware/query-parser.js` |       100% |   70.00% |      100% |   100% |
| `src/middleware/rateLimiter.js`  |       100% |     100% |      100% |   100% |

Middleware โดยรวมมี Coverage สูง เนื่องจากถูกเรียกใช้ในหลาย Test ของ API

---

### 4.4 External API Service

| ไฟล์                           | Statements | Branches | Functions |  Lines |
| ------------------------------ | ---------: | -------: | --------: | -----: |
| `src/services/external-api.js` |     96.29% |   85.71% |      100% | 95.83% |

External API Service มี Test ครอบคลุมทั้ง:

- การเรียก External API สำเร็จ
- กรณีไม่พบภาพยนตร์
- Retry เมื่อ External API ล้มเหลว
- Fallback เมื่อ Retry ครบจำนวนที่กำหนด
- Timeout และ Fallback

จึงมี Coverage อยู่ในระดับสูง

---

## 5. จุดที่ยังไม่มี Test ครอบคลุม

จากรายงาน Coverage พบว่ายังมีบางบรรทัดที่ไม่ได้ถูกเรียกใช้ระหว่างการ Test โดยเฉพาะใน `src/index.js`

ตัวอย่างส่วนที่ยังไม่ครอบคลุม ได้แก่:

- บางกรณีของ Authentication
- บางกรณีของ Movie API
- บางกรณีของ Genre API
- บางกรณีของ Movie-Genre Relationship
- บางเส้นทางของ Error Handling
- บาง Branch ของ Query Parser
- บางกรณีของ Authentication Middleware
- บางกรณีภายใน External API Service

รายละเอียดบรรทัดที่ Coverage ยังไม่ครอบคลุมสามารถตรวจสอบเพิ่มเติมได้จากรายงาน HTML:

```text
coverage/lcov-report/index.html
```

โดยรายงาน Coverage แสดง Uncovered Lines ของแต่ละไฟล์ไว้โดยตรง

---

## 6. สิ่งที่ Test Coverage ครอบคลุม

Test Suite ปัจจุบันครอบคลุมฟังก์ชันหลักของระบบ ได้แก่:

### Authentication

- Register
- Login
- JWT Authentication
- ตรวจสอบข้อมูลผู้ใช้
- Authentication Middleware
- Role-based Authorization

### Movie API

- GET Movies
- GET Movie By ID
- POST Movie
- PUT Movie
- DELETE Movie
- Validation
- Search
- Pagination
- Sorting

### RBAC

- กรณีไม่มี Token
- กรณี User พยายามทำรายการที่ต้องใช้ Admin
- กรณี Admin ทำรายการสำเร็จ

### Genre API

- GET Genres
- POST Genre
- Validation
- ตรวจสอบข้อมูลซ้ำ

### Movie-Genre Relationship

- GET Genres ของภาพยนตร์
- กำหนด Genre ให้ภาพยนตร์
- Validation ของ `genre_ids`
- ตรวจสอบ Movie ที่ไม่มีอยู่
- ตรวจสอบ Genre ที่ไม่มีอยู่
- Transaction ของการกำหนด Genre

### External Movie API

- External API Success
- Movie Not Found
- Retry
- Timeout
- Fallback

---

## 7. ข้อจำกัดของ Test Coverage

Test Coverage นี้เป็นการทดสอบ Backend API ผ่าน Jest และ Supertest ดังนั้นไม่ได้หมายความว่าโค้ดทุกส่วนของระบบถูกทดสอบในทุกสถานการณ์จริง

ส่วนที่ไม่ได้อยู่ใน Coverage ของ Jest โดยตรง ได้แก่:

- Frontend ที่อยู่ใน `frontend/`
- การทดสอบ UI ผ่าน Web Browser
- การทดสอบการใช้งาน Swagger UI ด้วยตนเอง
- การทดสอบ Postman/Newman
- การทำงานของ MySQL Server จริงในทุกกรณี
- การเชื่อมต่อ External API จริงในทุกสถานการณ์

ส่วนเหล่านี้สามารถตรวจสอบเพิ่มเติมด้วยการทดสอบระบบจริงและ Newman ได้

---

## 8. สรุป

ผลการทดสอบปัจจุบันของ Movies API Phase 3:

```text
Test Suites: 2 passed, 2 total
Tests:       32 passed, 32 total
```

และมี Test Coverage รวม:

```text
Statements: 81.96%
Branches:   71.30%
Functions:  83.87%
Lines:      81.58%
```

ระบบมี Test ครอบคลุมส่วนสำคัญของ Backend ได้แก่ Authentication, JWT, RBAC, Movie API, Genre API, Movie-Genre Relationship และ External Movie API

โดยเฉพาะ Middleware และ External API Service มี Coverage สูง ขณะที่ `src/index.js` มี Coverage ต่ำกว่าส่วนอื่น เนื่องจากเป็นไฟล์หลักที่รวม Endpoint และ Logic จำนวนมาก และยังมีบางกรณีที่ไม่ได้ถูกเรียกใช้จาก Test ปัจจุบัน

ผลการทดสอบล่าสุดยืนยันว่า **32 Tests ผ่านทั้งหมด และไม่มี Test ที่ล้มเหลว** จึงสามารถใช้ผลนี้เป็น Baseline ของ Test Coverage สำหรับ Phase 3 ได้
