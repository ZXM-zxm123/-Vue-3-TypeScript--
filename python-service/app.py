from flask import Flask, request, jsonify
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
import pickle
import os
import json

app = Flask(__name__)

CATEGORIES = ['餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '其他']

TRAINING_DATA = {
    '餐饮': [
        '麦当劳', '肯德基', '星巴克', '奶茶', '火锅', '烧烤', '自助餐',
        '早餐', '午餐', '晚餐', '外卖', '餐厅', '食堂', '小吃', '零食',
        '美团', '饿了么', '必胜客', '汉堡王', '咖啡', '面包', '蛋糕'
    ],
    '交通': [
        '地铁', '公交', '打车', '出租车', '滴滴', '停车', '加油',
        '火车票', '高铁', '飞机', '摩拜', 'ofo', '共享单车', '过路费'
    ],
    '购物': [
        '淘宝', '京东', '天猫', '超市', '便利店', '苏宁', '国美',
        '商场', '衣服', '鞋子', '包包', '化妆品', '电器', '日用品'
    ],
    '娱乐': [
        '电影', 'KTV', '酒吧', '演唱会', '游戏', '健身', '游泳',
        '旅游', '酒店', '门票', '会员', '视频', '音乐', '体育'
    ],
    '居住': [
        '房租', '水电费', '燃气费', '物业费', '宽带', '电话费',
        '装修', '家具', '家居', '房租', '房贷'
    ],
    '医疗': [
        '医院', '药店', '门诊', '挂号', '体检', '牙科', '眼科',
        '药品', '疫苗', '保健', '医生'
    ],
    '教育': [
        '学费', '培训', '课程', '书籍', '文具', '考试', '辅导班',
        '学校', '幼儿园', '补习'
    ],
    '其他': []
}

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

vectorizer = CountVectorizer()
classifier = MultinomialNB()

def train_model():
    global vectorizer, classifier

    texts = []
    labels = []

    for category, keywords in TRAINING_DATA.items():
        for keyword in keywords:
            texts.append(keyword)
            labels.append(category)

    for category, keywords in CUSTOM_RULES.items():
        for keyword in keywords:
            texts.append(keyword)
            labels.append(category)

    if texts:
        X = vectorizer.fit_transform(texts)
        classifier.fit(X, labels)
        save_model()

def save_model():
    with open(os.path.join(MODEL_DIR, 'vectorizer.pkl'), 'wb') as f:
        pickle.dump(vectorizer, f)
    with open(os.path.join(MODEL_DIR, 'classifier.pkl'), 'wb') as f:
        pickle.dump(classifier, f)

def load_model():
    global vectorizer, classifier

    vectorizer_path = os.path.join(MODEL_DIR, 'vectorizer.pkl')
    classifier_path = os.path.join(MODEL_DIR, 'classifier.pkl')

    if os.path.exists(vectorizer_path) and os.path.exists(classifier_path):
        with open(vectorizer_path, 'rb') as f:
            vectorizer = pickle.load(f)
        with open(classifier_path, 'rb') as f:
            classifier = pickle.load(f)
        return True
    return False

CUSTOM_RULES_FILE = os.path.join(MODEL_DIR, 'custom_rules.json')

def load_custom_rules():
    if os.path.exists(CUSTOM_RULES_FILE):
        with open(CUSTOM_RULES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_custom_rules():
    with open(CUSTOM_RULES_FILE, 'w', encoding='utf-8') as f:
        json.dump(CUSTOM_RULES, f, ensure_ascii=False, indent=2)

CUSTOM_RULES = load_custom_rules()

@app.route('/classify', methods=['POST'])
def classify():
    data = request.get_json()
    description = data.get('description', '')

    if not description:
        return jsonify({'category': '其他', 'confidence': 0})

    try:
        X = vectorizer.transform([description])
        prediction = classifier.predict(X)
        probabilities = classifier.predict_proba(X)
        confidence = probabilities[0].max()

        return jsonify({
            'category': prediction[0],
            'confidence': float(confidence)
        })
    except Exception as e:
        print(f"Classification error: {e}")
        return jsonify({'category': '其他', 'confidence': 0})

@app.route('/train', methods=['POST'])
def train():
    data = request.get_json()
    keyword = data.get('keyword', '')
    category = data.get('category', '')

    if not keyword or category not in CATEGORIES:
        return jsonify({'error': 'Invalid keyword or category'}), 400

    if category not in CUSTOM_RULES:
        CUSTOM_RULES[category] = []

    if keyword not in CUSTOM_RULES[category]:
        CUSTOM_RULES[category].append(keyword)
        save_custom_rules()
        train_model()

    return jsonify({'success': True, 'message': f'Trained: {keyword} -> {category}'})

@app.route('/rules', methods=['GET'])
def get_rules():
    return jsonify({
        'system': TRAINING_DATA,
        'custom': CUSTOM_RULES
    })

@app.route('/categories', methods=['GET'])
def get_categories():
    return jsonify({'categories': CATEGORIES})

if __name__ == '__main__':
    if not load_model():
        print("Training initial model...")
        train_model()
    print("NLP service running on http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=True)
