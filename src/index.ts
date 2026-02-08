import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { generateImageWithImagen } from './imagen.js'
import { editImageWithCanvas } from './canvas-editor.js'
import { editImageWithOCR } from './ocr-canvas-editor.js'

// Load .env file only in development
if (process.env.NODE_ENV !== 'production') {
  await import('dotenv/config')
}

const app = new Hono()

// CORS設定
app.use('/api/*', cors())

// 静的ファイル配信
app.use('/static/*', serveStatic({ root: './public' }))

// 価格計算関数
function calculatePrice(originalPrice: number, discountRate: number): number {
  return Math.round(originalPrice * (1 - discountRate / 100))
}

// 価格計算API
app.post('/api/calculate', async (c) => {
  try {
    const { discountRate } = await c.req.json()
    
    if (!discountRate || discountRate < 0 || discountRate > 100) {
      return c.json({ error: '割引率は0〜100の範囲で入力してください' }, 400)
    }

    // 元の価格（税込）
    const regularOriginalPrice = 4400
    const hardOriginalPrice = 4950

    // 割引後の価格を計算
    const regularPrice = calculatePrice(regularOriginalPrice, discountRate)
    const hardPrice = calculatePrice(hardOriginalPrice, discountRate)

    return c.json({
      discountRate,
      prices: {
        regular: {
          original: regularOriginalPrice,
          discounted: regularPrice
        },
        hard: {
          original: hardOriginalPrice,
          discounted: hardPrice
        }
      }
    })
  } catch (error) {
    return c.json({ error: 'リクエストの処理中にエラーが発生しました' }, 500)
  }
})

// 画像生成API
app.post('/api/generate-image', async (c) => {
  try {
    const formData = await c.req.formData()
    const imageFile = formData.get('image') as File
    const discountRate = formData.get('discountRate') as string
    const campaignType = formData.get('campaignType') as string

    if (!imageFile || !discountRate) {
      return c.json({ error: '画像と割引率は必須です' }, 400)
    }

    // 画像をBase64に変換（効率的な方法）
    const arrayBuffer = await imageFile.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize)
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    const base64Image = btoa(binary)
    const imageUrl = `data:${imageFile.type};base64,${base64Image}`

    // 価格計算
    const regularPrice = calculatePrice(4400, Number(discountRate))
    const hardPrice = calculatePrice(4950, Number(discountRate))

    // カスタムキャンペーン名の取得
    const customCampaignName = formData.get('customCampaignName') as string
    
    // キャンペーンタイトル設定
    const campaignTitle = campaignType === 'custom' && customCampaignName ? 
                          customCampaignName :
                          campaignType === 'thanksgiving' ? '大感謝祭 限定キャンペーン' : 
                          campaignType === 'marathon' ? 'お買い物マラソン限定キャンペーン' :
                          '限定キャンペーン'

    // NanoBanana画像生成用のプロンプト
    const prompt = `This is a Japanese promotional campaign image for a scalp brush product. 
The image should maintain the exact same layout and design as the reference image.

Campaign title at the top: "${campaignTitle}"
Product name: "スカルプブラシ コム"

Discount section with red arrow label showing: "${discountRate}% OFF"

Product pricing:
- Regular model (コムレギュラー): Original price ¥4,400 (税込) → Special price ¥${regularPrice.toLocaleString('ja-JP')} (税込)
- Hard model (コムハード): Original price ¥4,950 (税込) → Special price ¥${hardPrice.toLocaleString('ja-JP')} (税込)

Keep all other elements exactly the same including:
- Product images (white and brown brushes)
- Layout and positioning
- Typography and fonts
- Color scheme
- Footer text: "※割引率は変更になる可能性がございます"

IMPORTANT: Only change the discount percentage and calculated prices. Do NOT change any other design elements.`

    // NanoBanana API呼び出し用のリクエストボディを返す
    return c.json({
      success: true,
      prompt,
      imageUrl,
      prices: {
        regular: regularPrice,
        hard: hardPrice
      },
      discountRate: Number(discountRate)
    })

  } catch (error) {
    console.error('Image generation error:', error)
    return c.json({ error: '画像生成中にエラーが発生しました' }, 500)
  }
})

// 一括画像生成API
app.post('/api/generate-batch', async (c) => {
  try {
    const formData = await c.req.formData()
    const discountRate = formData.get('discountRate') as string
    const campaignType = formData.get('campaignType') as string
    const customCampaignName = formData.get('customCampaignName') as string
    
    if (!discountRate) {
      return c.json({ error: '割引率は必須です' }, 400)
    }

    // 複数の画像ファイルを取得
    const images: File[] = []
    let index = 0
    while (true) {
      const imageFile = formData.get(`image_${index}`) as File
      if (!imageFile) break
      images.push(imageFile)
      index++
    }

    if (images.length === 0) {
      return c.json({ error: '少なくとも1つの画像が必要です' }, 400)
    }

    // 価格計算
    const regularPrice = calculatePrice(4400, Number(discountRate))
    const hardPrice = calculatePrice(4950, Number(discountRate))

    // キャンペーンタイトル設定
    const campaignTitle = campaignType === 'custom' && customCampaignName ? 
                          customCampaignName :
                          campaignType === 'thanksgiving' ? '大感謝祭 限定キャンペーン' : 
                          campaignType === 'marathon' ? 'お買い物マラソン限定キャンペーン' :
                          '限定キャンペーン'

    // 各画像のプロンプトとURLを生成
    const imageData = await Promise.all(images.map(async (imageFile) => {
      const arrayBuffer = await imageFile.arrayBuffer()
      // より効率的なBase64変換（大きな画像でもスタックオーバーフローしない）
      const uint8Array = new Uint8Array(arrayBuffer)
      let binary = ''
      const chunkSize = 8192
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize)
        binary += String.fromCharCode.apply(null, Array.from(chunk))
      }
      const base64Image = btoa(binary)
      const imageUrl = `data:${imageFile.type};base64,${base64Image}`

      const prompt = `Edit this Japanese promotional campaign image for a scalp brush product.

KEEP THE EXACT SAME:
- All layout, design, and composition
- Product images (white and brown brushes)
- Background colors and graphics
- All fonts and typography styles
- Footer text: "※割引率は変更になる可能性がございます"

ONLY CHANGE THESE TEXT ELEMENTS:
1. Campaign title at top: "${campaignTitle}"
2. Discount label: "${discountRate}% OFF"
3. Regular model price: ¥4,400 (税込) → ¥${regularPrice.toLocaleString('ja-JP')} (税込)
4. Hard model price: ¥4,950 (税込) → ¥${hardPrice.toLocaleString('ja-JP')} (税込)

This is a precise text-only edit. Do not modify any visual design elements, colors, or layout.`

      return {
        prompt,
        imageUrl,
        originalName: imageFile.name
      }
    }))

    return c.json({
      success: true,
      count: images.length,
      images: imageData,
      prices: {
        regular: regularPrice,
        hard: hardPrice
      },
      discountRate: Number(discountRate),
      campaignTitle
    })

  } catch (error) {
    console.error('Batch generation error:', error)
    return c.json({ error: '一括画像生成中にエラーが発生しました' }, 500)
  }
})

// URL指定による一括画像生成API
app.post('/api/generate-batch-url', async (c) => {
  try {
    const { imageUrls, discountRate, campaignType, customCampaignName } = await c.req.json()
    
    if (!discountRate || !imageUrls || imageUrls.length === 0) {
      return c.json({ error: '画像URLと割引率は必須です' }, 400)
    }

    // 価格計算
    const regularPrice = calculatePrice(4400, Number(discountRate))
    const hardPrice = calculatePrice(4950, Number(discountRate))

    // キャンペーンタイトル設定
    const campaignTitle = campaignType === 'custom' && customCampaignName ? 
                          customCampaignName :
                          campaignType === 'thanksgiving' ? '大感謝祭 限定キャンペーン' : 
                          campaignType === 'marathon' ? 'お買い物マラソン限定キャンペーン' :
                          '限定キャンペーン'

    // 各画像URLのプロンプトを生成
    const imageData = imageUrls.map((imageUrl: string, index: number) => {
      const prompt = `Edit this Japanese promotional campaign image for a scalp brush product.

KEEP THE EXACT SAME:
- All layout, design, and composition
- Product images (white and brown brushes)
- Background colors and graphics
- All fonts and typography styles
- Footer text: "※割引率は変更になる可能性がございます"

ONLY CHANGE THESE TEXT ELEMENTS:
1. Campaign title at top: "${campaignTitle}"
2. Discount label: "${discountRate}% OFF"
3. Regular model price: ¥4,400 (税込) → ¥${regularPrice.toLocaleString('ja-JP')} (税込)
4. Hard model price: ¥4,950 (税込) → ¥${hardPrice.toLocaleString('ja-JP')} (税込)

This is a precise text-only edit. Do not modify any visual design elements, colors, or layout.`

      return {
        prompt,
        imageUrl,
        originalName: `image_${index + 1}`
      }
    })

    return c.json({
      success: true,
      count: imageUrls.length,
      images: imageData,
      prices: {
        regular: regularPrice,
        hard: hardPrice
      },
      discountRate: Number(discountRate),
      campaignTitle
    })

  } catch (error) {
    console.error('URL batch generation error:', error)
    return c.json({ error: 'URL指定による画像生成中にエラーが発生しました' }, 500)
  }
})

// OCR + Canvas画像編集API（新しい高度な実装）
app.post('/api/execute-generation', async (c) => {
  try {
    const { prompt, imageUrl, discountRate, index, campaignTitle, regularPrice, hardPrice } = await c.req.json()
    
    if (!imageUrl) {
      return c.json({ error: '画像URLは必須です' }, 400)
    }

    console.log(`Editing image ${index + 1} with OCR + Canvas...`)
    console.log('Campaign:', campaignTitle)
    console.log('Discount:', discountRate + '%')
    console.log('Prices:', regularPrice, hardPrice)

    // OCR + Canvas APIで画像編集（テキスト位置自動検出）
    const editedImageUrl = await editImageWithOCR({
      imageUrl,
      campaignTitle: campaignTitle || '限定キャンペーン',
      discountRate: Number(discountRate) || 0,
      regularPrice: Number(regularPrice) || 4400,
      hardPrice: Number(hardPrice) || 4950
    })

    console.log('OCR + Canvas editing completed, result size:', editedImageUrl?.length || 0)
    console.log('Edited image URL preview:', editedImageUrl?.substring(0, 100) || 'undefined')

    const response = {
      success: true,
      generated_images: [
        {
          url: editedImageUrl
        }
      ]
    }
    
    console.log('Response structure:', JSON.stringify({
      success: response.success,
      generated_images_count: response.generated_images.length,
      first_url_length: response.generated_images[0]?.url?.length || 0
    }))

    return c.json(response)

  } catch (error) {
    console.error('OCR + Canvas editing error:', error)
    return c.json({ 
      error: '画像編集中にエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// Vertex AI Imagen画像生成API（オプション：高度な編集用）
app.post('/api/execute-generation-ai', async (c) => {
  try {
    const { prompt, imageUrl, discountRate, index } = await c.req.json()
    
    if (!prompt) {
      return c.json({ error: 'プロンプトは必須です' }, 400)
    }

    console.log(`Generating image ${index + 1} with Vertex AI Imagen...`)
    console.log(`Prompt: ${prompt.substring(0, 100)}...`)

    // Vertex AI Imagenで画像生成
    const generatedImageUrl = await generateImageWithImagen({
      prompt,
      imageUrl, // 参照画像（編集モード）
      aspectRatio: '16:9'
    })

    console.log('Generated image URL length:', generatedImageUrl?.length || 0)
    console.log('Generated image URL preview:', generatedImageUrl?.substring(0, 100) || 'undefined')

    const response = {
      success: true,
      generated_images: [
        {
          url: generatedImageUrl
        }
      ]
    }
    
    console.log('Response structure:', JSON.stringify({
      success: response.success,
      generated_images_count: response.generated_images.length,
      first_url_length: response.generated_images[0]?.url?.length || 0
    }))

    return c.json(response)

  } catch (error) {
    console.error('Execute generation error:', error)
    return c.json({ error: '画像生成実行中にエラーが発生しました' }, 500)
  }
})

// ホームページ
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>画像編集システム - キャンペーン画像生成</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          .preview-container {
            max-width: 100%;
            border: 2px dashed #cbd5e0;
            border-radius: 8px;
            padding: 20px;
            min-height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .preview-image {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
          }
          .loading {
            display: none;
          }
          .loading.active {
            display: flex;
          }
        </style>
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div class="container mx-auto px-4 py-8 max-w-6xl">
            <div class="bg-white rounded-2xl shadow-2xl p-8">
                <h1 class="text-4xl font-bold text-gray-800 mb-2 text-center">
                    <i class="fas fa-image mr-3 text-indigo-600"></i>
                    画像編集システム
                </h1>
                <p class="text-gray-600 text-center mb-8">キャンペーン画像の割引率と価格を簡単に変更</p>
                
                <!-- 入力セクション -->
                <div class="grid md:grid-cols-2 gap-6 mb-8">
                    <!-- 左側: 画像アップロード -->
                    <div class="space-y-4">
                        <h2 class="text-xl font-semibold text-gray-700 mb-4">
                            <i class="fas fa-upload mr-2 text-indigo-500"></i>
                            1. 元画像をアップロード
                        </h2>
                        
                        <div class="mb-3">
                            <label class="flex items-center text-sm text-gray-600 mb-2">
                                <input type="radio" name="imageInputType" value="file" checked class="mr-2">
                                ファイルをアップロード
                            </label>
                            <label class="flex items-center text-sm text-gray-600">
                                <input type="radio" name="imageInputType" value="url" class="mr-2">
                                画像URLを入力
                            </label>
                        </div>
                        
                        <div id="fileUploadSection">
                            <div class="border-2 border-dashed border-indigo-300 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors cursor-pointer" id="dropZone">
                                <input type="file" id="imageInput" accept="image/*" multiple class="hidden">
                                <i class="fas fa-cloud-upload-alt text-5xl text-indigo-400 mb-3"></i>
                                <p class="text-gray-600">クリックまたはドラッグ&ドロップ</p>
                                <p class="text-sm text-gray-500 mt-2">PNG, JPG, JPEG対応（複数選択可能）</p>
                                <p class="text-xs text-green-600 mt-2">
                                    <i class="fas fa-compress-arrows-alt mr-1"></i>
                                    大きな画像は自動的に最適化されます（最大幅1920px、品質90%）
                                </p>
                            </div>
                            
                            <div id="uploadedImagesContainer" class="hidden space-y-2 mt-4">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-sm font-medium text-gray-700">選択した画像 (<span id="imageCount">0</span>枚)</span>
                                    <button id="clearImagesBtn" class="text-sm text-red-600 hover:text-red-800">
                                        <i class="fas fa-trash mr-1"></i>すべてクリア
                                    </button>
                                </div>
                                <div id="uploadedImagesList" class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto"></div>
                            </div>
                        </div>
                        
                        <div id="urlInputSection" class="hidden">
                            <div class="space-y-2">
                                <textarea id="imageUrls" rows="4" placeholder="画像URLを入力してください（1行に1URL）&#10;例:&#10;https://www.genspark.ai/api/files/s/gnHscP8A&#10;https://www.genspark.ai/api/files/s/dUVrMxmY" 
                                          class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"></textarea>
                                <p class="text-xs text-gray-500">複数のURLを入力する場合は改行で区切ってください</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 右側: 設定 -->
                    <div class="space-y-4">
                        <h2 class="text-xl font-semibold text-gray-700 mb-4">
                            <i class="fas fa-sliders-h mr-2 text-indigo-500"></i>
                            2. 設定を入力
                        </h2>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">キャンペーンタイプ</label>
                            <select id="campaignType" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="thanksgiving">大感謝祭 限定キャンペーン</option>
                                <option value="marathon">お買い物マラソン限定キャンペーン</option>
                                <option value="custom">カスタム</option>
                            </select>
                        </div>
                        
                        <div id="customCampaignNameContainer" class="hidden">
                            <label class="block text-sm font-medium text-gray-700 mb-2">カスタムキャンペーン名</label>
                            <input type="text" id="customCampaignName" placeholder="例: 春のセール限定キャンペーン" 
                                   class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">割引率 (%)</label>
                            <input type="number" id="discountRate" min="0" max="100" step="1" value="20" 
                                   class="w-full px-4 py-3 text-2xl font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                        
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <h3 class="font-semibold text-gray-700 mb-3">計算結果（税込価格）</h3>
                            <div class="space-y-2">
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-600">コムレギュラー:</span>
                                    <div class="text-right">
                                        <span class="text-xs text-gray-400 line-through">¥4,400</span>
                                        <span class="text-lg font-bold text-red-600 ml-2" id="regularPrice">¥3,520</span>
                                    </div>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-600">コムハード:</span>
                                    <div class="text-right">
                                        <span class="text-xs text-gray-400 line-through">¥4,950</span>
                                        <span class="text-lg font-bold text-red-600 ml-2" id="hardPrice">¥3,960</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex gap-3 mt-4">
                            <button onclick="openCoordinateSetup()" 
                                    class="flex-1 bg-gray-600 text-white font-bold py-4 rounded-lg hover:bg-gray-700 transition-all shadow-lg">
                                <i class="fas fa-crosshairs mr-2"></i>
                                座標を設定
                            </button>
                            <button id="generateBtn" disabled class="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                                <i class="fas fa-magic mr-2"></i>
                                画像を生成
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- 生成結果セクション -->
                <div id="resultSection" class="hidden mt-8 pt-8 border-t border-gray-200">
                    <h2 class="text-xl font-semibold text-gray-700 mb-4">
                        <i class="fas fa-check-circle mr-2 text-green-500"></i>
                        3. 生成された画像
                    </h2>
                    
                    <div id="loadingIndicator" class="loading flex-col items-center justify-center py-12">
                        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mb-4"></div>
                        <p class="text-gray-600">AI画像生成中...</p>
                        <p id="loadingProgress" class="text-sm text-gray-500 mt-2">処理中...</p>
                    </div>
                    
                    <div id="resultImagesContainer" class="hidden">
                        <div id="resultImagesList" class="grid grid-cols-1 md:grid-cols-2 gap-6"></div>
                        
                        <div class="flex gap-4 mt-6">
                            <button id="downloadAllBtn" 
                                    class="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-all">
                                <i class="fas fa-download mr-2"></i>
                                すべてダウンロード
                            </button>
                            <button id="resetBtn" 
                                    class="flex-1 bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-700 transition-all">
                                <i class="fas fa-redo mr-2"></i>
                                最初からやり直す
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 使い方ガイド -->
            <div class="bg-white rounded-lg shadow-lg p-6 mt-6">
                <h3 class="text-lg font-semibold text-gray-700 mb-3">
                    <i class="fas fa-info-circle mr-2 text-blue-500"></i>
                    使い方
                </h3>
                <ol class="list-decimal list-inside space-y-2 text-gray-600">
                    <li>キャンペーン画像（元画像）を1枚または複数枚アップロードします</li>
                    <li>キャンペーンタイプを選択（カスタムを選択すると独自の名前を入力できます）</li>
                    <li>割引率を入力します（価格が自動計算されます）</li>
                    <li>「画像を生成」ボタンをクリックすると、AIが新しい画像を生成します</li>
                    <li>生成された画像を個別にダウンロードするか、一括でダウンロードできます</li>
                </ol>
                <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p class="text-sm text-blue-800">
                        <i class="fas fa-info-circle mr-2"></i>
                        <strong>大きな画像について:</strong> 高解像度の画像をアップロードすると、自動的に最大幅1920pxにリサイズされ、90%品質で圧縮されます。処理速度が向上し、エラーを防ぎます。
                    </p>
                </div>
            </div>
        </div>
        
        <!-- 座標設定モーダル -->
        <div id="coordinateModal" class="fixed inset-0 bg-black bg-opacity-50 hidden flex items-center justify-center z-50" style="display: none;">
            <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
                <div class="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-crosshairs mr-2 text-indigo-600"></i>
                        座標設定
                    </h2>
                    <button onclick="closeCoordinateModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>
                
                <div class="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    <div class="grid md:grid-cols-3 gap-6">
                        <!-- 左側：プレビューキャンバス -->
                        <div class="md:col-span-2">
                            <div class="mb-4">
                                <h3 class="font-semibold text-gray-700 mb-2">1. 編集する領域を選択</h3>
                                <p class="text-sm text-gray-600 mb-3">
                                    マウスでドラッグして矩形を描画してください。自動的に次の領域に移動します。
                                </p>
                                <div class="flex gap-2 flex-wrap">
                                    <button class="area-btn active" data-area="campaign" onclick="selectArea('campaign')">
                                        <span class="color-dot" style="background: #FF6B6B"></span>
                                        キャンペーン名
                                    </button>
                                    <button class="area-btn" data-area="discount" onclick="selectArea('discount')">
                                        <span class="color-dot" style="background: #4ECDC4"></span>
                                        割引率
                                    </button>
                                    <button class="area-btn" data-area="regularPrice" onclick="selectArea('regularPrice')">
                                        <span class="color-dot" style="background: #FFD93D"></span>
                                        レギュラー価格
                                    </button>
                                    <button class="area-btn" data-area="hardPrice" onclick="selectArea('hardPrice')">
                                        <span class="color-dot" style="background: #6BCB77"></span>
                                        ハード価格
                                    </button>
                                </div>
                            </div>
                            
                            <div class="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                                <canvas id="coordinateCanvas" class="cursor-crosshair"></canvas>
                            </div>
                            
                            <div class="mt-4 flex gap-2">
                                <button onclick="resetCoordinates()" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                                    <i class="fas fa-undo mr-2"></i>
                                    リセット
                                </button>
                            </div>
                        </div>
                        
                        <!-- 右側：座標表示とテンプレート管理 -->
                        <div class="space-y-6">
                            <!-- 座標プレビュー -->
                            <div>
                                <h3 class="font-semibold text-gray-700 mb-2">2. 選択した座標</h3>
                                <div id="coordinatePreview" class="space-y-2 text-sm">
                                    <p class="text-gray-500">領域を選択してください</p>
                                </div>
                            </div>
                            
                            <!-- テンプレート保存 -->
                            <div class="border-t border-gray-200 pt-4">
                                <h3 class="font-semibold text-gray-700 mb-2">3. テンプレート保存</h3>
                                <div class="space-y-2">
                                    <input type="text" 
                                           id="templateName" 
                                           placeholder="テンプレート名（例：楽天バナー用）" 
                                           class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                                    <button onclick="saveCurrentTemplate()" 
                                            class="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                                        <i class="fas fa-save mr-2"></i>
                                        テンプレート保存
                                    </button>
                                </div>
                            </div>
                            
                            <!-- 保存済みテンプレート -->
                            <div class="border-t border-gray-200 pt-4">
                                <div class="flex justify-between items-center mb-2">
                                    <h3 class="font-semibold text-gray-700">保存済みテンプレート</h3>
                                    <div class="flex gap-1">
                                        <button onclick="exportTemplates()" 
                                                class="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                                                title="エクスポート">
                                            <i class="fas fa-download"></i>
                                        </button>
                                        <button onclick="importTemplates()" 
                                                class="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                                                title="インポート">
                                            <i class="fas fa-upload"></i>
                                        </button>
                                    </div>
                                </div>
                                <div id="templateList" class="space-y-2 max-h-64 overflow-y-auto">
                                    <p class="text-gray-500 text-sm">保存されたテンプレートはありません</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="p-6 border-t border-gray-200 flex justify-end gap-4">
                    <button onclick="closeCoordinateModal()" 
                            class="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                        キャンセル
                    </button>
                    <button onclick="applyCoordinates()" 
                            class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                        <i class="fas fa-check mr-2"></i>
                        この座標で生成
                    </button>
                </div>
            </div>
        </div>
        
        <style>
            .area-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 12px;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                background: white;
                cursor: pointer;
                transition: all 0.2s;
            }
            .area-btn:hover {
                border-color: #6366f1;
                background: #f0f9ff;
            }
            .area-btn.active {
                border-color: #6366f1;
                background: #eef2ff;
                font-weight: 600;
            }
            .color-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                display: inline-block;
            }
            .coordinate-item {
                padding: 10px;
                background: #f9fafb;
                border-radius: 6px;
                margin-bottom: 8px;
            }
            .coordinate-item strong {
                display: block;
                margin-bottom: 4px;
            }
            .coordinate-values {
                font-size: 12px;
                color: #6b7280;
                font-family: monospace;
            }
            .template-item {
                padding: 12px;
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .template-info {
                flex: 1;
            }
            .template-name {
                display: block;
                font-weight: 600;
                color: #1f2937;
            }
            .template-date, .template-size {
                font-size: 11px;
                color: #6b7280;
                margin-right: 8px;
            }
            .template-actions {
                display: flex;
                gap: 4px;
            }
            .btn-load, .btn-delete {
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }
            .btn-load {
                background: #6366f1;
                color: white;
            }
            .btn-load:hover {
                background: #4f46e5;
            }
            .btn-delete {
                background: #ef4444;
                color: white;
            }
            .btn-delete:hover {
                background: #dc2626;
            }
        </style>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/coordinate-selector.js"></script>
        <script src="/static/template-manager.js"></script>
        <script src="/static/app.js?v=${Date.now()}"></script>
    </body>
    </html>
  `)
})

export default app
