// Mock axios ก่อนโหลด external-api.js
// เพื่อไม่ให้ Test ยิง External API จริง
jest.mock("axios");

const axios = require("axios");
const { searchExternalMovie } = require("../src/services/external-api");

describe("External Movie API Tests", () => {
  beforeEach(() => {
    // ล้าง Mock ทุกครั้งก่อนเริ่ม Test ใหม่
    jest.clearAllMocks();

    // ปิดโหมดจำลอง Failure / Timeout
    process.env.OMDB_FORCE_FAILURE = "false";
    process.env.OMDB_FORCE_TIMEOUT = "false";

    // กำหนด API Key จำลองสำหรับ Test
    process.env.OMDB_API_KEY = "test-api-key";
  });

  afterAll(() => {
    // คืนค่า Environment หลัง Test เสร็จ
    process.env.OMDB_FORCE_FAILURE = "false";
    process.env.OMDB_FORCE_TIMEOUT = "false";
  });

  test("External API สำเร็จ ควรคืนข้อมูลจาก OMDb", async () => {
    // จำลอง Response จาก OMDb
    axios.get.mockResolvedValueOnce({
      data: {
        Response: "True",
        Title: "The Matrix",
        Year: "1999",
        Plot: "A computer hacker learns about the true nature of reality.",
      },
    });

    const result = await searchExternalMovie("The Matrix");

    expect(axios.get).toHaveBeenCalledTimes(1);

    expect(result.source).toBe("omdb");
    expect(result.message).toBe("ค้นหาข้อมูลภาพยนตร์จาก External API สำเร็จ");

    expect(result.data).toEqual({
      Response: "True",
      Title: "The Matrix",
      Year: "1999",
      Plot: "A computer hacker learns about the true nature of reality.",
    });
  });

  test("External API ไม่พบภาพยนตร์ ควรคืน source เป็น omdb และ data เป็น null", async () => {
    // จำลองกรณี OMDb ตอบว่าไม่พบข้อมูล
    axios.get.mockResolvedValueOnce({
      data: {
        Response: "False",
        Error: "Movie not found!",
      },
    });

    const result = await searchExternalMovie("Movie That Does Not Exist");

    expect(axios.get).toHaveBeenCalledTimes(1);

    expect(result.source).toBe("omdb");
    expect(result.message).toBe("Movie not found!");
    expect(result.data).toBeNull();
  });

  test("External API ล้มเหลว ควร Retry และคืน Fallback", async () => {
    // จำลอง External API ล้มเหลวทุกครั้ง
    process.env.OMDB_FORCE_FAILURE = "true";

    const result = await searchExternalMovie("Failure Test Movie");

    // ต้องลองทั้งหมด 3 ครั้ง
    // แต่กรณีนี้การ Failure ถูกจำลองก่อน axios.get
    // ดังนั้น axios จะไม่ถูกเรียก
    expect(axios.get).toHaveBeenCalledTimes(0);

    expect(result.source).toBe("fallback");

    expect(result.message).toBe("ไม่สามารถเชื่อมต่อ External API ได้ ข้อมูลนี้เป็นข้อมูลสำรอง");

    expect(result.data).toEqual({
      Title: "Failure Test Movie",
      Year: "Unknown",
      Plot: "External movie information is temporarily unavailable.",
    });
  });

  test("External API Timeout ควร Retry และคืน Fallback", async () => {
    // จำลอง Timeout
    process.env.OMDB_FORCE_TIMEOUT = "true";

    const result = await searchExternalMovie("Timeout Test Movie");

    // Timeout ถูกจำลองก่อน axios.get
    expect(axios.get).toHaveBeenCalledTimes(0);

    expect(result.source).toBe("fallback");

    expect(result.message).toBe("ไม่สามารถเชื่อมต่อ External API ได้ ข้อมูลนี้เป็นข้อมูลสำรอง");

    expect(result.data).toEqual({
      Title: "Timeout Test Movie",
      Year: "Unknown",
      Plot: "External movie information is temporarily unavailable.",
    });
  });
});
