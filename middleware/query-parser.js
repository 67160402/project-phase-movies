// รายการ Field ที่อนุญาตให้ใช้สำหรับการเรียงข้อมูล (Sorting) ใน SQL Query
// ใช้ Allowlist เพื่อป้องกันไม่ให้ผู้ใช้ส่งชื่อ column อื่นเข้า SQL โดยตรง
const ALLOWED_SORT_FIELDS = ["id", "title", "director", "release_year"];

// จัดการ Pagination จากการส่ง Query Parameter
// ตัวอย่าง เช่่น ?page=1&limit=8
function parsePagination(req, res, next) {
  // ถ้าไม่ได้ส่ง page มา ให้แสดงหน้าแรก (page = 1)
  const page = Math.max(1, parseInt(req.query.page) || 1);

  // ถ้าไม่ได้ส่ง limit มา ให้แสดงผลลัพธ์ 8 รายการต่อหน้า (limit = 8)
  // จำกัดสูงสุดไว้ที่ 100 รายการต่อหน้า
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 8));

  // คำนวณตำแหน่งเริ่มต้นของข้อมูลในฐานข้อมูล
  const offset = (page - 1) * limit;

  // เก็บค่าที่ผ่านการตรวจสอบไว้ใน req.pagination เพื่อให้ Middleware หรือ Endpoint ถัดไปสามารถเข้าถึงได้
  req.pagination = {
    page,
    limit,
    offset,
  };

  next();
}

// จัดการการเรียงข้อมูล
// ตัวอย่าง เช่น ?sort=title&order=asc
function parseSort(req, res, next) {
  // ถ้า sort ไม่อยู่ใน allowlist จะใช้ id เป็นค่าเริ่มต้น
  const field = ALLOWED_SORT_FIELDS.includes(req.query.sort)
    ? req.query.sort
    : "id";

  // รองรับเฉพาะ ASC และ DESC
  // ถ้าไม่ใช่ DESC จะใช้ ASC เป็นค่าเริ่มต้น
  const order = req.query.order === "desc" ? "DESC" : "ASC";

  // เก็บค่าที่ผ่านการตรวจสอบไว้ใน req.sort
  req.sort = {
    field,
    order,
  };

  next();
}

// จัดการคำค้นหาภาพยนตร์
// ตัวอย่าง เช่น ?q=batman
function parseSearch(req, res, next) {
  // ถ้ามี q ให้ตัดช่องว่างด้านหน้าและด้านหลังออก ถ้าไม่มีให้ใช้เป็น String ว่าง
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  req.search = {
    q,
  };

  next();
}

module.exports = {
  parsePagination,
  parseSort,
  parseSearch,
};
