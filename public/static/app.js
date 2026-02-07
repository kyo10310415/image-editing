// グローバル変数
let uploadedImageFiles = [];

// DOM要素
const dropZone = document.getElementById('dropZone');
const imageInput = document.getElementById('imageInput');
const uploadedImagesContainer = document.getElementById('uploadedImagesContainer');
const uploadedImagesList = document.getElementById('uploadedImagesList');
const imageCount = document.getElementById('imageCount');
const clearImagesBtn = document.getElementById('clearImagesBtn');
const discountRateInput = document.getElementById('discountRate');
const campaignTypeSelect = document.getElementById('campaignType');
const customCampaignNameContainer = document.getElementById('customCampaignNameContainer');
const customCampaignNameInput = document.getElementById('customCampaignName');
const regularPriceSpan = document.getElementById('regularPrice');
const hardPriceSpan = document.getElementById('hardPrice');
const generateBtn = document.getElementById('generateBtn');
const resultSection = document.getElementById('resultSection');
const loadingIndicator = document.getElementById('loadingIndicator');
const loadingProgress = document.getElementById('loadingProgress');
const resultImagesContainer = document.getElementById('resultImagesContainer');
const resultImagesList = document.getElementById('resultImagesList');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const resetBtn = document.getElementById('resetBtn');

// キャンペーンタイプ変更時の処理
campaignTypeSelect.addEventListener('change', () => {
    if (campaignTypeSelect.value === 'custom') {
        customCampaignNameContainer.classList.remove('hidden');
    } else {
        customCampaignNameContainer.classList.add('hidden');
    }
});

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
    
    const files = Array.from(e.dataTransfer.files);
    handleFileSelect(files);
});

// ファイル選択イベント
imageInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    handleFileSelect(files);
});

// ファイル処理
function handleFileSelect(files) {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        alert('画像ファイルを選択してください');
        return;
    }
    
    // 新しい画像を追加
    uploadedImageFiles = [...uploadedImageFiles, ...imageFiles];
    
    updateImagesList();
    generateBtn.disabled = false;
}

// 画像リストの更新
function updateImagesList() {
    uploadedImagesList.innerHTML = '';
    imageCount.textContent = uploadedImageFiles.length;
    
    if (uploadedImageFiles.length > 0) {
        uploadedImagesContainer.classList.remove('hidden');
        dropZone.classList.add('hidden');
        
        uploadedImageFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageItem = document.createElement('div');
                imageItem.className = 'relative group';
                imageItem.innerHTML = `
                    <img src="${e.target.result}" class="w-full h-32 object-cover rounded-lg border-2 border-gray-200">
                    <button class="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onclick="removeImage(${index})">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                    <p class="text-xs text-gray-600 mt-1 truncate">${file.name}</p>
                `;
                uploadedImagesList.appendChild(imageItem);
            };
            reader.readAsDataURL(file);
        });
    } else {
        uploadedImagesContainer.classList.add('hidden');
        dropZone.classList.remove('hidden');
    }
}

// 画像の削除
window.removeImage = function(index) {
    uploadedImageFiles.splice(index, 1);
    updateImagesList();
    
    if (uploadedImageFiles.length === 0) {
        generateBtn.disabled = true;
    }
};

// すべてクリア
clearImagesBtn.addEventListener('click', () => {
    uploadedImageFiles = [];
    updateImagesList();
    generateBtn.disabled = true;
});

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

// 生成された画像データ
let generatedImages = [];

// 画像生成
generateBtn.addEventListener('click', async () => {
    if (uploadedImageFiles.length === 0) {
        alert('画像をアップロードしてください');
        return;
    }
    
    const discountRate = parseFloat(discountRateInput.value);
    const campaignType = campaignTypeSelect.value;
    const customCampaignName = customCampaignNameInput.value;
    
    if (isNaN(discountRate) || discountRate < 0 || discountRate > 100) {
        alert('割引率は0〜100の範囲で入力してください');
        return;
    }
    
    if (campaignType === 'custom' && !customCampaignName) {
        alert('カスタムキャンペーン名を入力してください');
        return;
    }
    
    // UIの更新
    resultSection.classList.remove('hidden');
    loadingIndicator.classList.add('active');
    resultImagesContainer.classList.add('hidden');
    generateBtn.disabled = true;
    generatedImages = [];
    
    try {
        // FormDataの作成
        const formData = new FormData();
        uploadedImageFiles.forEach((file, index) => {
            formData.append(`image_${index}`, file);
        });
        formData.append('discountRate', discountRate);
        formData.append('campaignType', campaignType);
        if (customCampaignName) {
            formData.append('customCampaignName', customCampaignName);
        }
        
        // バックエンドAPIを呼び出してプロンプトを取得
        const response = await axios.post('/api/generate-batch', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        
        const { images, count } = response.data;
        
        loadingProgress.textContent = `${count}枚の画像を生成中...`;
        
        // 各画像を順次生成
        for (let i = 0; i < images.length; i++) {
            loadingProgress.textContent = `画像 ${i + 1}/${count} を生成中...`;
            
            const { prompt, imageUrl, originalName } = images[i];
            
            // NanoBanana APIを直接呼び出し
            const imageGenResponse = await axios.post('https://www.genspark.ai/api/genaimedia/v1/image', {
                model: 'nano-banana-pro',
                query: prompt,
                image_urls: [imageUrl],
                aspect_ratio: '16:9',
                task_summary: `Generate campaign image ${i + 1} with ${discountRate}% discount`
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (imageGenResponse.data && imageGenResponse.data.generated_images && 
                imageGenResponse.data.generated_images.length > 0) {
                
                const generatedImageUrl = imageGenResponse.data.generated_images[0].url;
                generatedImages.push({
                    url: generatedImageUrl,
                    originalName: originalName,
                    index: i
                });
            }
        }
        
        // すべての画像生成が完了
        displayGeneratedImages();
        loadingIndicator.classList.remove('active');
        resultImagesContainer.classList.remove('hidden');
        
    } catch (error) {
        console.error('画像生成エラー:', error);
        alert('画像生成中にエラーが発生しました。もう一度お試しください。');
        loadingIndicator.classList.remove('active');
    } finally {
        generateBtn.disabled = false;
    }
});

// 生成画像の表示
function displayGeneratedImages() {
    resultImagesList.innerHTML = '';
    
    generatedImages.forEach((image, index) => {
        const imageCard = document.createElement('div');
        imageCard.className = 'bg-white rounded-lg shadow-md overflow-hidden';
        imageCard.innerHTML = `
            <div class="preview-container">
                <img src="${image.url}" class="preview-image" alt="生成された画像 ${index + 1}">
            </div>
            <div class="p-4">
                <p class="text-sm text-gray-600 mb-2 truncate">${image.originalName}</p>
                <a href="${image.url}" download="campaign_${index + 1}_${discountRateInput.value}percent_off.png" 
                   class="block w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition-all text-center">
                    <i class="fas fa-download mr-2"></i>
                    ダウンロード
                </a>
            </div>
        `;
        resultImagesList.appendChild(imageCard);
    });
}

// すべてダウンロード
downloadAllBtn.addEventListener('click', () => {
    generatedImages.forEach((image, index) => {
        const link = document.createElement('a');
        link.href = image.url;
        link.download = `campaign_${index + 1}_${discountRateInput.value}percent_off.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});

// リセット
resetBtn.addEventListener('click', () => {
    uploadedImageFiles = [];
    generatedImages = [];
    updateImagesList();
    resultSection.classList.add('hidden');
    resultImagesContainer.classList.add('hidden');
    loadingIndicator.classList.remove('active');
    generateBtn.disabled = true;
    discountRateInput.value = 20;
    campaignTypeSelect.value = 'thanksgiving';
    customCampaignNameContainer.classList.add('hidden');
    customCampaignNameInput.value = '';
    calculatePrices();
});

// 初期価格計算
calculatePrices();
