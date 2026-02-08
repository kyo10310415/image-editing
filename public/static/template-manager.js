/**
 * テンプレート管理 - LocalStorageでテンプレートを保存・読み込み
 */

class TemplateManager {
    constructor() {
        this.storageKey = 'imageEditTemplates';
        this.templates = this.loadTemplates();
    }

    loadTemplates() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Failed to load templates:', error);
            return {};
        }
    }

    saveTemplates() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.templates));
            return true;
        } catch (error) {
            console.error('Failed to save templates:', error);
            return false;
        }
    }

    saveTemplate(name, coordinates) {
        if (!name || !coordinates) {
            throw new Error('テンプレート名と座標データが必要です');
        }

        // 既存テンプレートの上書き確認
        if (this.templates[name]) {
            const confirmed = confirm(`テンプレート「${name}」は既に存在します。上書きしますか？`);
            if (!confirmed) return false;
        }

        this.templates[name] = {
            name: name,
            areas: coordinates.areas,
            imageWidth: coordinates.imageWidth,
            imageHeight: coordinates.imageHeight,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const saved = this.saveTemplates();
        
        if (saved) {
            console.log(`✅ テンプレート「${name}」を保存しました`);
            this.updateTemplateList();
        }

        return saved;
    }

    getTemplate(name) {
        return this.templates[name] || null;
    }

    deleteTemplate(name) {
        if (!this.templates[name]) {
            console.warn(`テンプレート「${name}」は存在しません`);
            return false;
        }

        const confirmed = confirm(`テンプレート「${name}」を削除しますか？`);
        if (!confirmed) return false;

        delete this.templates[name];
        const saved = this.saveTemplates();

        if (saved) {
            console.log(`🗑️ テンプレート「${name}」を削除しました`);
            this.updateTemplateList();
        }

        return saved;
    }

    getAllTemplates() {
        return Object.values(this.templates);
    }

    updateTemplateList() {
        const templateList = document.getElementById('templateList');
        if (!templateList) return;

        const templates = this.getAllTemplates();

        if (templates.length === 0) {
            templateList.innerHTML = '<p class="text-gray-500 text-sm">保存されたテンプレートはありません</p>';
            return;
        }

        templateList.innerHTML = templates.map(template => {
            const date = new Date(template.updatedAt).toLocaleString('ja-JP');
            return `
                <div class="template-item" data-template="${template.name}">
                    <div class="template-info">
                        <strong class="template-name">${template.name}</strong>
                        <span class="template-date">${date}</span>
                        <span class="template-size">${template.imageWidth}x${template.imageHeight}</span>
                    </div>
                    <div class="template-actions">
                        <button class="btn-load" onclick="loadTemplate('${template.name}')">
                            <i class="fas fa-check"></i> 使用
                        </button>
                        <button class="btn-delete" onclick="deleteTemplate('${template.name}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    exportTemplates() {
        const data = JSON.stringify(this.templates, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `image-edit-templates-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('✅ テンプレートをエクスポートしました');
    }

    importTemplates(jsonData) {
        try {
            const imported = JSON.parse(jsonData);
            
            // 既存テンプレートとマージ
            this.templates = { ...this.templates, ...imported };
            this.saveTemplates();
            this.updateTemplateList();
            
            console.log(`✅ ${Object.keys(imported).length}個のテンプレートをインポートしました`);
            return true;
        } catch (error) {
            console.error('❌ テンプレートのインポートに失敗:', error);
            alert('テンプレートファイルの形式が正しくありません');
            return false;
        }
    }
}

// グローバル関数
window.templateManager = new TemplateManager();

window.saveCurrentTemplate = function() {
    const name = document.getElementById('templateName').value.trim();
    
    if (!name) {
        alert('テンプレート名を入力してください');
        return;
    }

    if (!window.coordinateSelector) {
        alert('座標が設定されていません');
        return;
    }

    const coordinates = window.coordinateSelector.getCoordinates();
    
    // 全ての領域が設定されているか確認
    const unsetAreas = Object.entries(coordinates.areas)
        .filter(([_, area]) => area === null)
        .map(([name, _]) => name);

    if (unsetAreas.length > 0) {
        const confirmed = confirm(`以下の領域が未設定です。このまま保存しますか？\n\n${unsetAreas.join(', ')}`);
        if (!confirmed) return;
    }

    const saved = window.templateManager.saveTemplate(name, coordinates);
    
    if (saved) {
        alert(`✅ テンプレート「${name}」を保存しました`);
        document.getElementById('templateName').value = '';
    }
};

window.loadTemplate = function(name) {
    const template = window.templateManager.getTemplate(name);
    
    if (!template) {
        alert('テンプレートが見つかりません');
        return;
    }

    if (!window.coordinateSelector) {
        alert('座標選択ツールが初期化されていません');
        return;
    }

    window.coordinateSelector.loadTemplate(template);
    alert(`✅ テンプレート「${name}」を読み込みました`);
    
    console.log('Loaded template:', template);
};

window.deleteTemplate = function(name) {
    window.templateManager.deleteTemplate(name);
};

window.exportTemplates = function() {
    window.templateManager.exportTemplates();
};

window.importTemplates = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            window.templateManager.importTemplates(event.target.result);
        };
        reader.readAsText(file);
    };

    input.click();
};

// 初期化時にテンプレートリストを更新
document.addEventListener('DOMContentLoaded', () => {
    window.templateManager.updateTemplateList();
});
