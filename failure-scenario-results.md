# ผลการทดสอบ Failure Scenario — Movie API

# Information

- Project: **Movie API**
- External API: OMDb API
- Endpoint: `GET /api/v1/external/movies`
- Timeout: 5,000 มิลลิวินาที (5 วินาที)
- จำนวนครั้งสูงสุด: 3 ครั้ง (เรียกครั้งแรก 1 ครั้ง และ Retry อีก 2 ครั้ง)

---

# Test Case 1: เรียก External API สำเร็จ

**ทดสอบค้นหาภาพยนตร์ที่มีข้อมูลอยู่ใน OMDb เช่น Inception**

- Request: `GET /api/v1/external/movies?title=Inception`
- ผลที่คาดหวัง: ระบบสามารถเรียกข้อมูลภาพยนตร์จาก OMDb และส่งข้อมูลกลับมาได้
- ผลที่เกิดขึ้นจริง: ได้ข้อมูลภาพยนตร์ Inception กลับมา โดย `source` เป็น `omdb`
- สถานะ: PASS

# Test Case 2: ไม่ส่งพารามิเตอร์ title

**เรียก API โดยไม่ระบุพารามิเตอร์ `title`**

- Request: `GET /api/v1/external/movies`
- ผลที่คาดหวัง: ระบบตอบกลับ Code `400 Bad Request` พร้อมรหัส `VALIDATION_ERROR`
- ผลที่เกิดขึ้นจริง: ได้รับ Code `400 Bad Request` พร้อมข้อความแจ้งให้ระบุชื่อภาพยนตร์ผ่าน query parameter `title`
- สถานะ: PASS

# Test Case 3: จำลอง External API ล้มเหลว

**ตั้งค่า `OMDB_FORCE_FAILURE=true` เพื่อจำลองความล้มเหลวของ External API**

- Request: `GET /api/v1/external/movies?title=Inception`
- ผลที่คาดหวัง: ระบบลองเรียก API สูงสุด 3 ครั้ง (ครั้งแรกและ Retry อีก 2 ครั้ง) และส่งข้อมูลสำรองเมื่อทุกครั้งล้มเหลว
- ผลที่เกิดขึ้นจริง: Terminal แสดงการเรียกที่ล้มเหลวตั้งแต่ `attempt 1/3` ถึง `attempt 3/3` จากนั้นระบบส่งข้อมูลสำรองกลับมา โดย `source` เป็น `fallback`
- สถานะ: PASS

# Test Case 4: จำลอง Timeout

**ตั้งค่า `OMDB_FORCE_TIMEOUT=true` เพื่อจำลองข้อผิดพลาด Timeout**

- Request: `GET /api/v1/external/movies?title=Inception`
- ผลที่คาดหวัง: ระบบลองเรียกใหม่ตามจำนวนที่กำหนด และส่งข้อมูลสำรองเมื่อครบทุกครั้ง
- ผลที่เกิดขึ้นจริง: ระบบส่งข้อมูลสำรองกลับมา โดย `source` เป็น `fallback`
- หมายเหตุ: กรณีนี้เป็นการจำลอง Timeout เพื่อทดสอบการจัดการข้อผิดพลาด ไม่ใช่เหตุขัดข้องจริงจาก OMDb
- สถานะ: PASS

# Test Case 5: กลับมาทำงานปกติหลังทดสอบ

**ปิดโหมดจำลองความล้มเหลว แล้วทดสอบเรียกข้อมูลภาพยนตร์อีกครั้ง**

- การตั้งค่า:
  - `OMDB_FORCE_FAILURE=false`
  - `OMDB_FORCE_TIMEOUT=false`
- Request: `GET /api/v1/external/movies?title=Inception`
- ผลที่คาดหวัง: ระบบกลับมาเรียก OMDb และส่งข้อมูลภาพยนตร์ได้ตามปกติ
- ผลที่เกิดขึ้นจริง: ได้ข้อมูลภาพยนตร์ Inception จาก OMDb โดย `source` เป็น `omdb`
- สถานะ: PASS

---

# สรุปผลการทดสอบ (Summary)

จากการทดสอบ Movie API สามารถเรียกข้อมูลภาพยนตร์จาก OMDb ได้ตามปกติ ตรวจสอบคำขอที่ไม่มีพารามิเตอร์ `title` ได้อย่างถูกต้อง และจัดการความล้มเหลวด้วย Retry และ Fallback ได้ตามที่ออกแบบไว้ นอกจากนี้ยังทดสอบ Timeout ด้วยการจำลองสถานการณ์ และตรวจสอบว่าระบบกลับมาทำงานปกติได้หลังปิดโหมดจำลอง
