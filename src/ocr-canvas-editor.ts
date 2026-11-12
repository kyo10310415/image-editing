import { createCanvas, loadImage, Image } from 'canvas';
import { getLayout, recognizeLayout } from './ocr-layout.js';

interface EditImageParams {
  imageUrl: string;
  campaignTitle: string;
  discountRate: number;
  regularPrice: number;
  hardPrice: number;
}

interface TextBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

/**
 * OCRでテキスト位置を検出してCanvas編集
 */
export async function editImageWithOCR(params: EditImageParams): Promise<string> {
  const { imageUrl, campaignTitle, discountRate, regularPrice, hardPrice } = params;

  try {
    console.log('🔍 Starting OCR + Canvas image editing...');
    console.log('Campaign:', campaignTitle);
    console.log('Discount:', discountRate + '%');
    console.log('Prices:', regularPrice, hardPrice);

    // 画像を読み込む
    const image = await loadImage(imageUrl);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // 元の画像を描画
    ctx.drawImage(image, 0, 0);

    console.log('📊 Image size:', image.width, 'x', image.height);

    // OCRでテキスト検出
    console.log('🔍 Running OCR to detect text positions...');
    const ocrResult = await recognizeLayout(imageUrl, (m) => {
      if (m.status === 'recognizing text') {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    });

    console.log('✅ OCR completed');
    const { words, lines } = getLayout(ocrResult.data);

    console.log('📝 Detected text boxes:', words.length, 'words,', lines.length, 'lines');

    // 検出されたテキストボックスを解析
    let textBoxes: TextBox[] = [];
    
    if (words.length > 0) {
      // wordsを使用
      textBoxes = words.map(word => ({
        text: word.text,
        x: word.bbox.x0,
        y: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0,
        confidence: word.confidence
      }));
    } else if (lines.length > 0) {
      // wordsがない場合はlinesを使用
      textBoxes = lines.map(line => ({
        text: line.text,
        x: line.bbox.x0,
        y: line.bbox.y0,
        width: line.bbox.x1 - line.bbox.x0,
        height: line.bbox.y1 - line.bbox.y0,
        confidence: line.confidence
      }));
    } else {
      console.warn('⚠️ No text detected by OCR, using fallback method');
      // OCRが何も検出しなかった場合はフォールバック
      return editImageWithSimpleCanvas(params);
    }

    // デバッグ: 検出されたテキストを出力
    console.log('📝 Detected texts:');
    textBoxes.forEach(box => {
      if (box.confidence > 60) {
        console.log(`  "${box.text}" at (${box.x}, ${box.y}) - confidence: ${box.confidence}%`);
      }
    });

    // ターゲットテキストを検出
    const targets = detectTargetTexts(textBoxes, discountRate);

    console.log('🎯 Target areas detected:', targets.length);

    // 各ターゲット領域を編集
    for (const target of targets) {
      console.log(`📝 Editing: ${target.type}`);
      
      // 領域の背景色を抽出
      const bgColor = extractBackgroundColor(ctx, target.box);
      console.log(`  Background color: rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`);

      // 領域を背景色で塗りつぶし（少し大きめに）
      const padding = 10;
      ctx.fillStyle = `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
      ctx.fillRect(
        target.box.x - padding,
        target.box.y - padding,
        target.box.width + padding * 2,
        target.box.height + padding * 2
      );

      // 新しいテキストを描画
      drawNewText(ctx, target, params, bgColor);
    }

    // Canvas を Data URL として返す
    const result = canvas.toDataURL('image/png');
    console.log('✅ OCR + Canvas editing completed');

    return result;

  } catch (error) {
    console.error('❌ OCR + Canvas editing error:', error);
    throw new Error(`OCR + Canvas image editing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * ターゲットテキストを検出
 */
function detectTargetTexts(textBoxes: TextBox[], currentDiscount: number): Array<{
  type: 'campaign' | 'discount' | 'regular_original' | 'regular_price' | 'hard_original' | 'hard_price';
  box: TextBox;
}> {
  const targets: Array<any> = [];

  // キャンペーンタイトルを検出（上部の大きなテキスト）
  const campaignBox = textBoxes.find(box => 
    box.y < 200 && 
    box.width > 200 &&
    (box.text.includes('キャンペーン') || box.text.includes('限定') || box.text.includes('感謝'))
  );
  if (campaignBox) {
    targets.push({ type: 'campaign', box: campaignBox });
  }

  // 割引率を検出
  const discountBox = textBoxes.find(box => 
    box.text.includes('%') || 
    box.text.includes('OFF') ||
    box.text.includes(currentDiscount.toString())
  );
  if (discountBox) {
    targets.push({ type: 'discount', box: discountBox });
  }

  // 価格を検出（4,400円、4,950円など）
  const priceBoxes = textBoxes.filter(box => 
    box.text.match(/[0-9,]+円/) || 
    box.text.match(/¥[0-9,]+/) ||
    box.text.includes('4,400') ||
    box.text.includes('4,950') ||
    box.text.includes('3,520') ||
    box.text.includes('3,960')
  );

  priceBoxes.forEach(box => {
    // Y座標で上下を判定
    if (box.y < 400) {
      targets.push({ type: 'regular_original', box });
    } else {
      targets.push({ type: 'regular_price', box });
    }
  });

  return targets;
}

/**
 * 領域の背景色を抽出
 */
function extractBackgroundColor(ctx: any, box: TextBox): ColorRGB {
  try {
    // テキストボックスの周辺ピクセルをサンプリング
    const samplePoints = [
      { x: box.x - 5, y: box.y - 5 },
      { x: box.x + box.width + 5, y: box.y - 5 },
      { x: box.x - 5, y: box.y + box.height + 5 },
      { x: box.x + box.width + 5, y: box.y + box.height + 5 }
    ];

    const colors: ColorRGB[] = [];
    
    for (const point of samplePoints) {
      const imageData = ctx.getImageData(point.x, point.y, 1, 1);
      const data = imageData.data;
      colors.push({ r: data[0], g: data[1], b: data[2] });
    }

    // 平均色を計算
    const avgColor = {
      r: Math.round(colors.reduce((sum, c) => sum + c.r, 0) / colors.length),
      g: Math.round(colors.reduce((sum, c) => sum + c.g, 0) / colors.length),
      b: Math.round(colors.reduce((sum, c) => sum + c.b, 0) / colors.length)
    };

    return avgColor;
  } catch (error) {
    // エラー時はデフォルト色（ゴールド）
    return { r: 189, g: 170, b: 124 };
  }
}

/**
 * 新しいテキストを描画
 */
function drawNewText(
  ctx: any, 
  target: any, 
  params: EditImageParams,
  bgColor: ColorRGB
) {
  const { campaignTitle, discountRate, regularPrice, hardPrice } = params;
  const box = target.box;

  // テキスト色を背景色から自動決定（明るい背景なら暗い文字、暗い背景なら明るい文字）
  const brightness = (bgColor.r * 299 + bgColor.g * 587 + bgColor.b * 114) / 1000;
  const textColor = brightness > 128 ? '#333333' : '#FFFFFF';
  const accentColor = '#E60012'; // 楽天レッド

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  switch (target.type) {
    case 'campaign':
      // キャンペーンタイトル
      ctx.fillStyle = brightness > 128 ? '#FFFFFF' : '#333333';
      ctx.font = `bold ${Math.floor(box.height * 0.8)}px "Noto Sans JP", Arial, sans-serif`;
      ctx.fillText(campaignTitle, box.x, box.y);
      break;

    case 'discount':
      // 割引率
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.floor(box.height * 0.7)}px Arial`;
      ctx.fillText(`${discountRate}% OFF`, box.x, box.y);
      break;

    case 'regular_price':
      // レギュラー価格
      ctx.fillStyle = accentColor;
      ctx.font = `bold ${Math.floor(box.height * 0.8)}px Arial`;
      ctx.fillText(`¥${regularPrice.toLocaleString('ja-JP')}`, box.x, box.y);
      break;

    case 'hard_price':
      // ハード価格
      ctx.fillStyle = accentColor;
      ctx.font = `bold ${Math.floor(box.height * 0.8)}px Arial`;
      ctx.fillText(`¥${hardPrice.toLocaleString('ja-JP')}`, box.x, box.y);
      break;

    case 'regular_original':
    case 'hard_original':
      // 元価格（変更しない場合はスキップ可能）
      break;
  }
}

/**
 * フォールバック: OCRが失敗した場合は固定座標を使用
 */
export async function editImageWithFallback(params: EditImageParams): Promise<string> {
  console.log('⚠️ Using fallback method (fixed coordinates)');
  
  // OCRが失敗した場合は、元のCanvas実装を使用
  // （固定座標版）
  
  return editImageWithOCR(params); // 一旦OCRを試みる
}

/**
 * シンプルなCanvas編集（OCRなし、固定座標）
 * 元画像 https://www.genspark.ai/api/files/s/gnHscP8A のレイアウトに基づく
 */
async function editImageWithSimpleCanvas(params: EditImageParams): Promise<string> {
  const { imageUrl, campaignTitle, discountRate, regularPrice, hardPrice } = params;

  console.log('🎨 Using simple Canvas method without OCR');

  try {
    const image = await loadImage(imageUrl);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // 元の画像を描画
    ctx.drawImage(image, 0, 0);

    console.log('📐 Image dimensions:', image.width, 'x', image.height);

    // ゴールド背景色（元画像から抽出）
    const goldBg = 'rgb(189, 170, 124)';
    const whiteBg = 'rgb(255, 255, 255)';
    const redLabel = 'rgb(230, 0, 18)';

    // 1. キャンペーンタイトルエリア（上部中央の白テキスト）
    // 座標: 中央、上部
    ctx.fillStyle = goldBg;
    const titleX = image.width / 2 - 400;
    const titleY = 60;
    const titleWidth = 800;
    const titleHeight = 80;
    ctx.fillRect(titleX, titleY, titleWidth, titleHeight);
    
    // タイトルを描画
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 52px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(campaignTitle, image.width / 2, titleY + titleHeight / 2);

    // 2. 赤いラベルの割引率エリア
    // 座標: 左側の赤いラベル内
    const discountX = 143;
    const discountY = 312;
    const discountWidth = 320;
    const discountHeight = 130;
    
    // 赤背景を再描画（元のラベルを保持）
    // テキスト部分のみクリア
    ctx.fillStyle = redLabel;
    ctx.fillRect(discountX + 50, discountY + 10, discountWidth - 100, discountHeight - 20);
    
    // 割引率テキスト
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 72px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${discountRate}`, discountX + discountWidth / 2, discountY + 50);
    ctx.font = 'bold 40px Arial';
    ctx.fillText('%OFF', discountX + discountWidth / 2, discountY + 95);

    // 3. レギュラー価格エリア（左下、ピンクのラベル下）
    // 座標: "コム レギュラー" の下
    const regPriceX = 517;
    const regPriceY = 563;
    const priceWidth = 200;
    const priceHeight = 60;
    
    // 白背景で既存価格をクリア
    ctx.fillStyle = whiteBg;
    ctx.fillRect(regPriceX, regPriceY, priceWidth, priceHeight);
    
    // 新しい価格を描画（赤字、太字）
    ctx.fillStyle = redLabel;
    ctx.font = 'bold 44px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`¥${regularPrice.toLocaleString('ja-JP')}`, regPriceX, regPriceY + 40);

    // 4. ハード価格エリア（右下、ピンクのラベル下）
    // 座標: "コム ハード" の下
    const hardPriceX = 517;
    const hardPriceY = 720;
    
    // 白背景で既存価格をクリア
    ctx.fillStyle = whiteBg;
    ctx.fillRect(hardPriceX, hardPriceY, priceWidth, priceHeight);
    
    // 新しい価格を描画（赤字、太字）
    ctx.fillStyle = redLabel;
    ctx.font = 'bold 44px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`¥${hardPrice.toLocaleString('ja-JP')}`, hardPriceX, hardPriceY + 40);

    const result = canvas.toDataURL('image/png');
    console.log('✅ Simple Canvas editing completed');
    console.log('📊 Result size:', result.length, 'characters');
    
    return result;

  } catch (error) {
    console.error('❌ Simple Canvas error:', error);
    throw error;
  }
}
