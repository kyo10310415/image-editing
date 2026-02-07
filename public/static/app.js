// グローバル変数
let uploadedImageFile = null;
let uploadedImageDataUrl = null;

// DOM要素
const dropZone = document.getElementById('dropZone');
const imageInput = document.getElementById('imageInput');
const uploadedImagePreview = document.getElementById('uploadedImagePreview');
const uploadedImage = document.getElementById('uploadedImage');
const discountRateInput = document.getElementById('discountRate');
const campaignTypeSelect = document.getElementById('campaignType');
const regularPriceSpan = document.getElementById('regularPrice');
const hardPriceSpan = document.getElementById('hardPrice');
const generateBtn = document.getElementById('generateBtn');
const resultSection = document.getElementById('resultSection');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultImageContainer = document.getElementById('resultImageContainer');
const resultImage = document.getElementById('resultImage');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');

// ドロップゾーンのクリックイベント
dropZone.addEventListener('click', () => {
    imageInput.click();
});

// ドラッグ&ドロップイベント
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-indigo-500', 'bg-indigo-50');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

// ファイル選択イベント
imageInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

// ファイル処理
function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください');
        return;
    }
    
    uploadedImageFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedImageDataUrl = e.target.result;
        uploadedImage.src = e.target.result;
        uploadedImagePreview.classList.remove('hidden');
        dropZone.classList.add('hidden');
        generateBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

// 価格計算
async function calculatePrices() {
    const discountRate = parseFloat(discountRateInput.value);
    
    if (isNaN(discountRate) || discountRate < 0 || discountRate > 100) {
        return;
    }
    
    try {
        const response = await axios.post('/api/calculate', {
            discountRate: discountRate
        });
        
        const data = response.data;
        regularPriceSpan.textContent = `¥${data.prices.regular.discounted.toLocaleString('ja-JP')}`;
        hardPriceSpan.textContent = `¥${data.prices.hard.discounted.toLocaleString('ja-JP')}`;
    } catch (error) {
        console.error('価格計算エラー:', error);
    }
}

// 割引率変更時の価格自動計算
discountRateInput.addEventListener('input', calculatePrices);

// 画像生成
generateBtn.addEventListener('click', async () => {
    if (!uploadedImageFile) {
        alert('画像をアップロードしてください');
        return;
    }
    
    const discountRate = parseFloat(discountRateInput.value);
    const campaignType = campaignTypeSelect.value;
    
    if (isNaN(discountRate) || discountRate < 0 || discountRate > 100) {
        alert('割引率は0〜100の範囲で入力してください');
        return;
    }
    
    // UIの更新
    resultSection.classList.remove('hidden');
    loadingIndicator.classList.add('active');
    resultImageContainer.classList.add('hidden');
    generateBtn.disabled = true;
    
    try {
        // FormDataの作成
        const formData = new FormData();
        formData.append('image', uploadedImageFile);
        formData.append('discountRate', discountRate);
        formData.append('campaignType', campaignType);
        
        // バックエンドAPIを呼び出してプロンプトを取得
        const response = await axios.post('/api/generate-image', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        
        const { prompt, imageUrl, prices } = response.data;
        
        // NanoBanana APIを直接呼び出し
        const imageGenResponse = await axios.post('https://www.genspark.ai/api/genaimedia/v1/image', {
            model: 'nano-banana-pro',
            query: prompt,
            image_urls: [imageUrl],
            aspect_ratio: '16:9',
            task_summary: `Generate a Japanese campaign image with ${discountRate}% discount`
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Image generation response:', imageGenResponse.data);
        
        if (imageGenResponse.data && imageGenResponse.data.generated_images && 
            imageGenResponse.data.generated_images.length > 0) {
            
            const generatedImageUrl = imageGenResponse.data.generated_images[0].url;
            
            // 生成された画像を表示
            resultImage.src = generatedImageUrl;
            downloadBtn.href = generatedImageUrl;
            downloadBtn.download = `campaign_${discountRate}percent_off.png`;
            
            loadingIndicator.classList.remove('active');
            resultImageContainer.classList.remove('hidden');
        } else {
            throw new Error('画像生成に失敗しました');
        }
        
    } catch (error) {
        console.error('画像生成エラー:', error);
        alert('画像生成中にエラーが発生しました。もう一度お試しください。');
        loadingIndicator.classList.remove('active');
    } finally {
        generateBtn.disabled = false;
    }
});

// リセット
resetBtn.addEventListener('click', () => {
    uploadedImageFile = null;
    uploadedImageDataUrl = null;
    uploadedImagePreview.classList.add('hidden');
    dropZone.classList.remove('hidden');
    resultSection.classList.add('hidden');
    resultImageContainer.classList.add('hidden');
    loadingIndicator.classList.remove('active');
    generateBtn.disabled = true;
    discountRateInput.value = 20;
    calculatePrices();
});

// 初期価格計算
calculatePrices();
