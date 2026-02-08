import { createCanvas, loadImage, Image } from 'canvas';
import Tesseract from 'tesseract.js';

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
    const ocrResult = await Tesseract.recognize(imageUrl, 'jpn+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    console.log('✅ OCR completed');
    
    // OCR結果のデバッグ出力
    console.log('📊 OCR Result structure:', {
      hasData: !!ocrResult.data,
      hasWords: !!ocrResult.data?.words,
      hasLines: !!ocrResult.data?.lines,
      text: ocrResult.data?.text?.substring(0, 100)
    });

    // wordsが存在しない場合はlinesを使用
    const words = ocrResult.data?.words || [];
    const lines = ocrResult.data?.lines || [];
    
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
    const result = canvas.toDataURL('image/png', 0.95);
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

    // 画像サイズに応じてスケール調整
    const scale = image.width / 1080; // 基準幅1080px

    // 固定座標（元画像のレイアウトに基づく）
    const areas = {
      // キャンペーンタイトル（上部）
      campaign: {
        x: image.width * 0.15,
        y: image.height * 0.08,
        width: image.width * 0.7,
        height: image.height * 0.1
      },
      // 割引率（左側の赤いラベル内）
      discount: {
        x: image.width * 0.18,
        y: image.height * 0.35,
        width: image.width * 0.15,
        height: image.height * 0.08
      },
      // レギュラー価格（左下）
      regularPrice: {
        x: image.width * 0.48,
        y: image.height * 0.61,
        width: image.width * 0.15,
        height: image.height * 0.05
      },
      // ハード価格（右下）
      hardPrice: {
        x: image.width * 0.48,
        y: image.height * 0.78,
        width: image.width * 0.15,
        height: image.height * 0.05
      }
    };

    // ゴールド背景色
    const bgColor = { r: 189, g: 170, b: 124 };

    // 各領域を編集
    for (const [key, area] of Object.entries(areas)) {
      // 背景色で塗りつぶし
      ctx.fillStyle = `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
      ctx.fillRect(area.x, area.y, area.width, area.height);

      // テキストを描画
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      switch (key) {
        case 'campaign':
          ctx.font = `bold ${Math.floor(36 * scale)}px Arial, sans-serif`;
          ctx.fillText(campaignTitle, area.x + area.width / 2, area.y + area.height / 2);
          break;

        case 'discount':
          ctx.font = `bold ${Math.floor(48 * scale)}px Arial`;
          ctx.fillText(`${discountRate}%`, area.x + area.width / 2, area.y + area.height / 2 - 10 * scale);
          ctx.font = `bold ${Math.floor(28 * scale)}px Arial`;
          ctx.fillText('OFF', area.x + area.width / 2, area.y + area.height / 2 + 20 * scale);
          break;

        case 'regularPrice':
          ctx.fillStyle = '#E60012';
          ctx.font = `bold ${Math.floor(32 * scale)}px Arial`;
          ctx.textAlign = 'left';
          ctx.fillText(`¥${regularPrice.toLocaleString('ja-JP')}`, area.x, area.y + area.height / 2);
          break;

        case 'hardPrice':
          ctx.fillStyle = '#E60012';
          ctx.font = `bold ${Math.floor(32 * scale)}px Arial`;
          ctx.textAlign = 'left';
          ctx.fillText(`¥${hardPrice.toLocaleString('ja-JP')}`, area.x, area.y + area.height / 2);
          break;
      }
    }

    const result = canvas.toDataURL('image/png', 0.95);
    console.log('✅ Simple Canvas editing completed');
    return result;

  } catch (error) {
    console.error('❌ Simple Canvas error:', error);
    throw error;
  }
}
