// This is server-side code and needs to be deployed to Firebase Cloud Functions.
// It cannot be run directly in the browser.

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

const NAVER_CLIENT_ID = "ia8iVvOxZs4cLLzl5wUc"; // Step 1에서 복사한 Client ID
const NAVER_CLIENT_SECRET = "Rc4GEVZF7z"; // Step 1에서 복사한 Client Secret

exports.naverLogin = functions.https.onCall(async (data, context) => {
  const code = data.code;
  const state = data.state;

  // 1. Get Naver Access Token
  const tokenUrl = `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${NAVER_CLIENT_ID}&client_secret=${NAVER_CLIENT_SECRET}&code=${code}&state=${state}`;
  
  let tokenResponse;
  try {
    tokenResponse = await axios.get(tokenUrl);
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to get Naver token.');
  }

  const accessToken = tokenResponse.data.access_token;

  // 2. Get Naver User Profile
  const profileUrl = "https://openapi.naver.com/v1/nid/me";
  let profileResponse;
  try {
    profileResponse = await axios.get(profileUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to get Naver profile.');
  }

  const naverUser = profileResponse.data.response;
  const uid = `naver:${naverUser.id}`;
  const email = naverUser.email;
  const displayName = naverUser.name;

  // 3. Create a custom Firebase token
  try {
    const customToken = await admin.auth().createCustomToken(uid, { email, displayName });
    return { token: customToken };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to create custom token.');
  }
});
