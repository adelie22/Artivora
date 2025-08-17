const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true }); // CORS 라이브러리 추가


// --- 마지막 해결책: 이 코드를 추가하세요 ---
// 에뮬레이터 환경일 경우, Auth 에뮬레이터의 주소를 명시적으로 설정
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}
// -----------------------------------------

admin.initializeApp({
  projectId: 'artivora-90c86',
});

exports.naverLogin = functions.https.onRequest((request, response) => {
  // cors 미들웨어를 사용하여 요청을 감싸줍니다.
  cors(request, response, async () => {
    // 데이터를 request.body.data에서 가져옵니다.
    const { code, state } = request.body.data;

    // 환경 변수에서 네이버 클라이언트 ID와 시크릿을 가져옵니다.
    const NAVER_CLIENT_ID = functions.config().naver.client_id;
    const NAVER_CLIENT_SECRET = functions.config().naver.client_secret;

    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      functions.logger.error("Naver Client ID or Secret is not set in Firebase environment config.");
      // 에러 발생 시 500 상태 코드와 에러 메시지를 응답합니다.
      response.status(500).send({ error: { message: "서버에 네이버 설정이 완료되지 않았습니다. 관리자에게 문의하세요." } });
      return;
    }

    const tokenUrl = 'https://nid.naver.com/oauth2.0/token';
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: NAVER_CLIENT_ID,
      client_secret: NAVER_CLIENT_SECRET,
      code,
      state,
    });

    let tokenResponse;
    try {
      functions.logger.info("Requesting Naver Access Token...");
      tokenResponse = await axios.post(tokenUrl, tokenBody, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      functions.logger.info("Successfully received Naver Access Token.");
    } catch (error) {
      functions.logger.error("Failed to get Naver token:", error.response?.data || error.message);
      response.status(500).send({ error: { message: "네이버 토큰을 가져오는 데 실패했습니다." } });
      return;
    }

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      functions.logger.error("Access token not found in Naver's response.", tokenResponse.data);
      response.status(500).send({ error: { message: "네이버 응답에 액세스 토큰이 없습니다." } });
      return;
    }

    const profileUrl = "https://openapi.naver.com/v1/nid/me";
    let profileResponse;
    try {
      functions.logger.info("Requesting Naver User Profile...");
      profileResponse = await axios.get(profileUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      functions.logger.info("Successfully received Naver User Profile.");
    } catch (error) {
      functions.logger.error("Failed to get Naver profile:", error.response?.data || error.message);
      response.status(500).send({ error: { message: "네이버 프로필을 가져오는 데 실패했습니다." } });
      return;
    }

    const naverUser = profileResponse.data.response;
    if (!naverUser || !naverUser.id) {
        functions.logger.error("Invalid Naver profile response.", profileResponse.data);
        response.status(500).send({ error: { message: "유효하지 않은 네이버 프로필 정보입니다." } });
        return;
    }

    const uid = `naver:${naverUser.id}`;
    const email = naverUser.email;
    const displayName = naverUser.name;

    try {
      functions.logger.info(`Creating Firebase custom token for UID: ${uid}`);
      const customToken = await admin.auth().createCustomToken(uid, { email, displayName });
      functions.logger.info("Successfully created Firebase custom token.");
      
      // 성공 시, onCall 형식에 맞게 { data: { ... } } 형태로 응답을 보냅니다.
      response.send({ data: { token: customToken } });
    } catch (error) {
      functions.logger.error("Failed to create Firebase custom token:", error.message);
      response.status(500).send({ error: { message: "Firebase 인증 토큰 생성에 실패했습니다." } });
    }
  });
});