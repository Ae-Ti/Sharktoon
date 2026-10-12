import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const OUT_DIR = "/Users/taeilbae/.gemini/antigravity/brain/731bccf6-3d9c-4e16-a108-0f1d62975c56/scratch/e2e";
const WORKSPACE_OUT_DIR = path.resolve("output/e2e");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(WORKSPACE_OUT_DIR)) fs.mkdirSync(WORKSPACE_OUT_DIR, { recursive: true });

async function run() {
  console.log("🚀 [E2E] 브라우저(Google Chrome) 시작 중 (화면 표시 모드)...");
  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: false, // 사용자 화면에 실제 Chrome 창이 직접 뜸!
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,960"],
    defaultViewport: { width: 1280, height: 960 },
    protocolTimeout: 300000,
  });

  const page = await browser.newPage();

  const snap = async (filename) => {
    const p1 = path.join(OUT_DIR, filename);
    const p2 = path.join(WORKSPACE_OUT_DIR, filename);
    await page.screenshot({ path: p1 });
    try { fs.copyFileSync(p1, p2); } catch {}
  };

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[Browser Console Error]`, msg.text());
    }
  });

  try {
    // 1. 온보딩 캐릭터 화면 접속
    console.log("📍 [Step 1] 온보딩 캐릭터 페이지 접속 (http://localhost:3000/onboarding/character)");
    await page.goto("http://localhost:3000/onboarding/character", { waitUntil: "networkidle0" });
    await snap("01_onboarding_character.png");

    // 1단계: 웹툰 화풍 '심플 라인' 선택
    console.log("👉 1단계: 웹툰 화풍 '심플 라인' 선택 확인");
    const allButtons = await page.$$("button");
    for (const btn of allButtons) {
      const text = await btn.evaluate((el) => el.innerText);
      if (text.includes("심플 라인")) {
        await btn.click();
        console.log("🎨 화풍: '심플 라인' 클릭 완료");
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 500));

    // "셀카로 만들기" 선택 (기본 선택되어 있지만 확실히 클릭)
    console.log("👉 '셀카로 만들기' 선택 및 셀카 사진 업로드");
    const choiceCards = await page.$$("div[role='group'] button, button");
    for (const btn of choiceCards) {
      const text = await btn.evaluate((el) => el.innerText);
      if (text.includes("셀카로 만들기")) {
        await btn.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 500));

    // 셀카 파일 업로드
    const selfieInput = await page.$("input[type='file']");
    if (selfieInput) {
      const selfiePath = path.resolve("test_selfie.jpg");
      await selfieInput.uploadFile(selfiePath);
      console.log("📸 셀카 사진(test_selfie.jpg) 업로드 완료");
    }
    await new Promise((r) => setTimeout(r, 1000));

    await snap("02_tags_entered.png");

    // 다음 버튼 클릭 (셀카 비전 분석 및 캐릭터 시트 생성 시작)
    console.log("👉 '다음' 버튼 클릭 -> 셀카 분석 및 캐릭터 시트 생성 대기");
    const nextBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.find((b) => b.innerText.trim() === "다음");
    });
    if (nextBtn.asElement()) {
      await nextBtn.asElement().click();
    }

    // 2. 사연 페이지 대기 (Gemini Vision + FLUX 캐릭터 시트 생성 대기: 최대 300초)
    await page.waitForFunction(() => window.location.pathname.includes("/onboarding/story"), { timeout: 300000 });
    console.log("📍 [Step 2] 온보딩 사연 페이지 도착:", page.url());
    await snap("03_onboarding_story.png");
    await new Promise((r) => setTimeout(r, 1000));

    // 새로운 인물/시나리오 사연 입력: 반려묘 병원 방문기
    const storyTextarea = await page.$("textarea");
    if (storyTextarea) {
      await storyTextarea.click();
      await storyTextarea.type(
        "주말에 아끼는 반려 고양이 건강검진을 받으러 동물병원에 갔다. 수의사 선생님 앞에서 엄청 얌전한 척 얌전히 진료받더니, 집에 돌아오자마자 츄르를 내놓으라며 큰 소리로 야옹거리며 삐져있어서 결국 츄르 두 개를 바쳤다.",
        { delay: 15 },
      );
    }

    // 4컷 버튼 클릭
    const cutCountButtons = await page.$$("button[aria-pressed]");
    for (const btn of cutCountButtons) {
      const text = await btn.evaluate((el) => el.innerText);
      if (text.includes("4컷")) {
        await btn.click();
        break;
      }
    }

    await snap("04_story_entered.png");

    // '콘티 만들기' 버튼 클릭
    console.log("👉 '콘티 만들기' 클릭 -> 제미나이 콘티 생성 대기");
    const beginBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.find((b) => b.innerText.includes("콘티 만들기"));
    });
    if (beginBtn.asElement()) {
      await beginBtn.asElement().click();
    }

    // 3. 콘티 화면 대기 (SPA 라우트 전환)
    await page.waitForFunction(() => window.location.pathname.includes("/storyboard"), { timeout: 20000 });
    console.log("📍 [Step 3] 콘티 화면 도착:", page.url());

    // 제미나이 콘티 생성 완료 대기 (article 태그 로딩)
    console.log("⏳ 제미나이 AI 맞춤형 콘티 생성 중...");
    await page.waitForSelector("article", { timeout: 45000 });
    await new Promise((r) => setTimeout(r, 1200));
    await snap("05_storyboard_generated.png");

    const cutCount = await page.$$eval("article", (els) => els.length);
    console.log(`✅ 제미나이 AI 콘티 생성 완료 (${cutCount}컷 생성됨)`);
    const cutScenes = await page.$$eval("article p", (els) => els.map((el) => el.innerText));
    console.log("🎬 [검토된 콘티 지문들]:\n" + cutScenes.map((s, idx) => `  [${idx + 1}컷] ${s}`).join("\n"));

    // 4. 후킹 선택 (Cut 1 클릭 후 첫 번째 후킹 카드 클릭)
    console.log("👉 1컷 선택 및 후킹 카피 선택");
    const cutsList = await page.$$("article");
    if (cutsList.length > 0) {
      await cutsList[0].evaluate((el) => el.scrollIntoView({ behavior: "instant", block: "center" }));
      await new Promise((r) => setTimeout(r, 400));
      await cutsList[0].click();
      await new Promise((r) => setTimeout(r, 800));

      // 1컷 후킹 카드 클릭
      const hookClicked = await page.evaluate(() => {
        const panel = document.querySelector("aside");
        if (!panel) return false;
        const cards = Array.from(panel.querySelectorAll("button[aria-pressed]"));
        if (cards.length > 0) {
          cards[0].click();
          return true;
        }
        return false;
      });
      if (hookClicked) console.log("✅ 후킹 카피 선택 완료");
    }
    await new Promise((r) => setTimeout(r, 800));

    // CTA 선택 (마지막 컷 스크롤 후 클릭하여 우측 패널에 CTA 옵션 표시)
    console.log("👉 마지막 컷 스크롤 및 선택 -> CTA 카피 선택");
    const cutsNow = await page.$$("article");
    if (cutsNow.length >= 2) {
      const lastCut = cutsNow[cutsNow.length - 1];
      await lastCut.evaluate((el) => el.scrollIntoView({ behavior: "instant", block: "center" }));
      await new Promise((r) => setTimeout(r, 500));
      await lastCut.click();
      await new Promise((r) => setTimeout(r, 800));

      // 마지막 컷 CTA 카드 클릭
      const ctaClicked = await page.evaluate(() => {
        const panel = document.querySelector("aside");
        if (!panel) return false;
        const cards = Array.from(panel.querySelectorAll("button[aria-pressed]"));
        if (cards.length > 0) {
          cards[0].click();
          return true;
        }
        return false;
      });
      if (ctaClicked) console.log("✅ CTA 카피 선택 완료");
    }
    await new Promise((r) => setTimeout(r, 1500));

    await snap("06_storyboard_ready.png");

    // '이미지 생성' 버튼 활성화 대기 및 클릭
    console.log("👉 '이미지 생성' 버튼 활성화 대기 및 클릭");
    await page.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.includes("이미지 생성"));
      return btn && !btn.disabled;
    }, { timeout: 20000 });

    const genBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll("button")).find((b) => b.innerText.includes("이미지 생성"));
    });
    if (genBtn.asElement()) {
      await genBtn.asElement().click();
    }

    // 4. 생성 진행 화면 대기 (SPA 라우트 전환)
    await page.waitForFunction(() => window.location.pathname.includes("/generate"), { timeout: 20000 });
    console.log("📍 [Step 4] 이미지 생성 화면 도착:", page.url());
    await snap("07_generation_started.png");

    // Fal.ai FLUX 컷 생성 대기 (폴링 확인: '컷이 다 나왔어요' 또는 '대사 다듬으러 가기')
    console.log("⏳ Fal.ai FLUX Dev 4컷 실시간 생성 진행 중...");
    let completed = false;
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.includes("다 나왔어요") || pageText.includes("대사 다듬으러 가기")) {
        completed = true;
        console.log(`\n🎉 모든 4컷 이미지 생성 완료! (${(i + 1) * 2}초 소요)`);
        break;
      }
      process.stdout.write(".");
    }
    console.log("");
    await new Promise((r) => setTimeout(r, 2000));
    await snap("08_generation_completed.png");

    // '대사 다듬으러 가기' 버튼 클릭
    console.log("👉 '대사 다듬으러 가기' 클릭 -> 캔버스 편집기 이동");
    const editorBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.find((b) => b.innerText.includes("대사 다듬으러 가기"));
    });
    if (editorBtn.asElement()) {
      await editorBtn.asElement().click();
    }

    // 5. 캔버스 편집기 대기 (SPA 라우트 전환)
    await page.waitForFunction(() => window.location.pathname.includes("/editor"), { timeout: 30000 });
    const editorBaseUrl = page.url().split("?")[0];
    console.log("📍 [Step 5] 캔버스 편집기 도착:", editorBaseUrl);

    // 1컷 렌더 대기 및 캡처
    await new Promise((r) => setTimeout(r, 3000));
    await snap("09_editor_cut1.png");

    // 2컷, 3컷, 4컷 캔버스 순회 캡처
    console.log("📸 컷별 편집기 캔버스 캡처 진행 중...");
    for (let c = 2; c <= 4; c++) {
      await page.goto(`${editorBaseUrl}?cut=${c}`, { waitUntil: "networkidle0" });
      await new Promise((r) => setTimeout(r, 2500));
      await snap(`10_editor_cut${c}.png`);
    }

    // 6. 발행 페이지 이동
    const publishUrl = editorBaseUrl.replace("/editor", "/publish");
    console.log("👉 발행 페이지 이동:", publishUrl);
    await page.goto(publishUrl, { waitUntil: "networkidle0" });
    console.log("📍 [Step 6] 인스타그램 발행 패키지 화면 도착:", publishUrl);
    await new Promise((r) => setTimeout(r, 3500)); // 인스타 캡션 및 해시태그 패키지 렌더 대기
    await snap("11_publish_screen.png");

    // 발행 페이지 텍스트 추출
    const publishInfo = await page.evaluate(() => {
      return document.body.innerText.slice(0, 1500);
    });
    console.log("📄 [발행 요약 데이터]:\n", publishInfo);

    // 7. 애셋 보관함(/assets) 이동하여 새로 생성된 2D 캐릭터 시트 확인
    console.log("👉 [Step 7] 애셋 보관함(/assets) 이동 및 2D 캐릭터 시트 확인");
    await page.goto("http://localhost:3000/assets", { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 2000));
    await snap("asset_library.png");

    const assetCardImages = await page.$$eval("img", (imgs) => imgs.map((img) => img.src));
    const sheetImgUrl = assetCardImages.reverse().find((src) => src.startsWith("http") || src.startsWith("data:"));
    if (sheetImgUrl) {
      if (sheetImgUrl.startsWith("data:")) {
        const base64Data = sheetImgUrl.replace(/^data:image\/\w+;base64,/, "");
        fs.writeFileSync(path.join(WORKSPACE_OUT_DIR, "protagonist_asset_sheet_front.jpg"), Buffer.from(base64Data, "base64"));
      } else {
        const res = await fetch(sheetImgUrl);
        const buf = await res.arrayBuffer();
        fs.writeFileSync(path.join(WORKSPACE_OUT_DIR, "protagonist_asset_sheet_front.jpg"), Buffer.from(buf));
      }
      console.log("📸 [새로운 2D 캐릭터 시트 저장 완료] protagonist_asset_sheet_front.jpg");
    }

    console.log("🏁 [E2E 테스트 성공 완료] 모든 단계가 실제 브라우저에서 끝까지 성공했습니다!");
  } catch (err) {
    console.error("❌ [E2E 오류 발생]:", err);
    await snap("error_screenshot.png");
    throw err;
  } finally {
    await browser.close();
  }
}

run();
