import numpy as np


class ManualLogisticRegression:
    def __init__(self, lr=0.1, max_iter=1000, tol=1e-4):
        self.lr = lr
        self.max_iter = max_iter
        self.tol = tol
        self.W = None
        self.b = None
        self.classes_ = None

    def _softmax(self, Z):
        Z_shift = Z - np.max(Z, axis=1, keepdims=True)
        exp_Z = np.exp(Z_shift)
        return exp_Z / np.sum(exp_Z, axis=1, keepdims=True)

    def _one_hot(self, y, n_classes):
        OHE = np.zeros((len(y), n_classes))
        OHE[np.arange(len(y)), y] = 1
        return OHE

    def fit(self, X, y):
        X = np.array(X, dtype=float)
        y = np.array(y, dtype=int)
        self.classes_ = np.unique(y)
        n_samples, n_features = X.shape
        n_classes = len(self.classes_)
        self.W = np.zeros((n_features, n_classes))
        self.b = np.zeros((1, n_classes))
        Y_ohe = self._one_hot(y, n_classes)
        for _ in range(self.max_iter):
            Z = X @ self.W + self.b
            P = self._softmax(Z)
            dW = (1 / n_samples) * (X.T @ (P - Y_ohe))
            db = (1 / n_samples) * np.sum(P - Y_ohe, axis=0, keepdims=True)
            W_new = self.W - self.lr * dW
            b_new = self.b - self.lr * db
            if np.max(np.abs(W_new - self.W)) < self.tol:
                self.W, self.b = W_new, b_new
                break
            self.W, self.b = W_new, b_new
        return self

    def predict(self, X):
        X = np.array(X, dtype=float)
        Z = X @ self.W + self.b
        P = self._softmax(Z)
        return np.argmax(P, axis=1)


class ManualDecisionTree:
    def __init__(self, criterion='gini', max_depth=None, min_samples_split=2, min_samples_leaf=1):
        self.criterion = criterion
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.min_samples_leaf = min_samples_leaf
        self.tree = None

    def _gini(self, y):
        n = len(y)
        if n == 0:
            return 0.0
        classes, counts = np.unique(y, return_counts=True)
        probs = counts / n
        return 1.0 - np.sum(probs ** 2)

    def _entropy(self, y):
        n = len(y)
        if n == 0:
            return 0.0
        classes, counts = np.unique(y, return_counts=True)
        probs = counts / n
        probs = probs[probs > 0]
        return -np.sum(probs * np.log2(probs))

    def _impurity(self, y):
        if self.criterion == 'gini':
            return self._gini(y)
        return self._entropy(y)

    def _best_split(self, X, y):
        best_gain = -1
        best_feat = None
        best_thresh = None
        n = len(y)
        base_impurity = self._impurity(y)
        for feat in range(X.shape[1]):
            thresholds = np.unique(X[:, feat])
            for thresh in thresholds:
                left_mask = X[:, feat] <= thresh
                right_mask = ~left_mask
                if np.sum(left_mask) < self.min_samples_leaf or np.sum(right_mask) < self.min_samples_leaf:
                    continue
                gain = base_impurity - (
                    (np.sum(left_mask) / n) * self._impurity(y[left_mask]) +
                    (np.sum(right_mask) / n) * self._impurity(y[right_mask])
                )
                if gain > best_gain:
                    best_gain = gain
                    best_feat = feat
                    best_thresh = thresh
        return best_feat, best_thresh

    def _build(self, X, y, depth):
        if (len(np.unique(y)) == 1 or
                len(y) < self.min_samples_split or
                (self.max_depth is not None and depth >= self.max_depth)):
            vals, counts = np.unique(y, return_counts=True)
            return {'leaf': True, 'label': vals[np.argmax(counts)]}
        feat, thresh = self._best_split(X, y)
        if feat is None:
            vals, counts = np.unique(y, return_counts=True)
            return {'leaf': True, 'label': vals[np.argmax(counts)]}
        left_mask = X[:, feat] <= thresh
        right_mask = ~left_mask
        return {
            'leaf': False,
            'feat': feat,
            'thresh': thresh,
            'left': self._build(X[left_mask], y[left_mask], depth + 1),
            'right': self._build(X[right_mask], y[right_mask], depth + 1)
        }

    def fit(self, X, y):
        X = np.array(X, dtype=float)
        y = np.array(y, dtype=int)
        self.tree = self._build(X, y, 0)
        return self

    def _predict_one(self, x, node):
        if node['leaf']:
            return node['label']
        if x[node['feat']] <= node['thresh']:
            return self._predict_one(x, node['left'])
        return self._predict_one(x, node['right'])

    def predict(self, X):
        X = np.array(X, dtype=float)
        return np.array([self._predict_one(x, self.tree) for x in X])


class ManualDecisionTreeForest(ManualDecisionTree):
    def fit(self, X, y, feature_indices):
        X = np.array(X, dtype=float)
        y = np.array(y, dtype=int)
        self.feature_indices = feature_indices
        self.tree = self._build(X, y, 0)
        return self

    def _best_split(self, X, y):
        best_gain = -1
        best_feat = None
        best_thresh = None
        n = len(y)
        base_impurity = self._impurity(y)
        for feat in self.feature_indices:
            thresholds = np.unique(X[:, feat])
            for thresh in thresholds:
                left_mask = X[:, feat] <= thresh
                right_mask = ~left_mask
                if np.sum(left_mask) < self.min_samples_leaf or np.sum(right_mask) < self.min_samples_leaf:
                    continue
                gain = base_impurity - (
                    (np.sum(left_mask) / n) * self._impurity(y[left_mask]) +
                    (np.sum(right_mask) / n) * self._impurity(y[right_mask])
                )
                if gain > best_gain:
                    best_gain = gain
                    best_feat = feat
                    best_thresh = thresh
        return best_feat, best_thresh


class ManualRandomForest:
    def __init__(self, n_estimators=100, max_depth=15, min_samples_split=2,
                 min_samples_leaf=1, max_features='sqrt', random_state=42):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.min_samples_leaf = min_samples_leaf
        self.max_features = max_features
        self.random_state = random_state
        self.trees = []
        self.feature_sets = []

    def _bootstrap(self, X, y, rng):
        n = len(y)
        idx = rng.choice(n, size=n, replace=True)
        return X[idx], y[idx]

    def _select_features(self, n_features, rng):
        if self.max_features == 'sqrt':
            k = max(1, int(np.sqrt(n_features)))
        elif self.max_features == 'log2':
            k = max(1, int(np.log2(n_features)))
        else:
            k = n_features
        return rng.choice(n_features, size=k, replace=False)

    def fit(self, X, y):
        X = np.array(X, dtype=float)
        y = np.array(y, dtype=int)
        rng = np.random.RandomState(self.random_state)
        self.trees = []
        self.feature_sets = []
        n_features = X.shape[1]
        for _ in range(self.n_estimators):
            X_boot, y_boot = self._bootstrap(X, y, rng)
            feat_idx = self._select_features(n_features, rng)
            tree = ManualDecisionTreeForest(
                criterion='gini',
                max_depth=self.max_depth,
                min_samples_split=self.min_samples_split,
                min_samples_leaf=self.min_samples_leaf
            )
            tree.fit(X_boot, y_boot, feat_idx)
            self.trees.append(tree)
            self.feature_sets.append(feat_idx)
        return self

    def predict(self, X):
        X = np.array(X, dtype=float)
        all_preds = np.array([tree.predict(X) for tree in self.trees])
        final_preds = []
        for i in range(X.shape[0]):
            votes = all_preds[:, i]
            vals, counts = np.unique(votes, return_counts=True)
            final_preds.append(vals[np.argmax(counts)])
        return np.array(final_preds)

    @property
    def feature_importances_(self):
        actual_features = max(max(f) for f in self.feature_sets) + 1
        importances = np.zeros(actual_features)
        for tree, feats in zip(self.trees, self.feature_sets):
            gain = self._tree_feature_gain(tree.tree, feats)
            for f, g in gain.items():
                importances[f] += g
        total = importances.sum()
        return importances / total if total > 0 else importances

    def _tree_feature_gain(self, node, feat_idx):
        gains = {}
        if node['leaf']:
            return gains
        f = node['feat']
        gains[f] = gains.get(f, 0) + 1
        gains.update(self._tree_feature_gain(node['left'], feat_idx))
        gains.update(self._tree_feature_gain(node['right'], feat_idx))
        return gains


class ManualKNN:
    def __init__(self, n_neighbors=5):
        self.k = n_neighbors
        self.X_train = None
        self.y_train = None

    def fit(self, X, y):
        self.X_train = np.array(X, dtype=float)
        self.y_train = np.array(y, dtype=int)
        return self

    def _euclidean(self, a, b):
        return np.sqrt(np.sum((a - b) ** 2, axis=1))

    def predict(self, X):
        X = np.array(X, dtype=float)
        predictions = []
        for x in X:
            dists = self._euclidean(self.X_train, x)
            k_idx = np.argsort(dists)[:self.k]
            k_labels = self.y_train[k_idx]
            vals, counts = np.unique(k_labels, return_counts=True)
            predictions.append(vals[np.argmax(counts)])
        return np.array(predictions)


class ManualSVM:
    def __init__(self, C=1.0, max_iter=1000, lr=0.001):
        self.C = C
        self.max_iter = max_iter
        self.lr = lr
        self.classifiers = {}
        self.classes_ = None

    def _rbf_kernel(self, X1, X2, gamma):
        sq_dists = (
            np.sum(X1 ** 2, axis=1, keepdims=True) +
            np.sum(X2 ** 2, axis=1) -
            2 * X1 @ X2.T
        )
        return np.exp(-gamma * sq_dists)

    def _train_binary(self, K, y_bin):
        n = len(y_bin)
        alpha = np.zeros(n)
        for _ in range(self.max_iter):
            for i in range(n):
                decision = np.sum(alpha * y_bin * K[i])
                if y_bin[i] * decision < 1:
                    alpha[i] += self.lr * (1 - y_bin[i] * decision)
                    alpha[i] = min(alpha[i], self.C)
                else:
                    alpha[i] *= (1 - self.lr * 0.01)
        return alpha

    def fit(self, X, y):
        X = np.array(X, dtype=float)
        y = np.array(y, dtype=int)
        self.classes_ = np.unique(y)
        self.X_train = X
        gamma = 1.0 / X.shape[1]
        K = self._rbf_kernel(X, X, gamma)
        self.gamma = gamma
        for cls in self.classes_:
            y_bin = np.where(y == cls, 1, -1).astype(float)
            alpha = self._train_binary(K, y_bin)
            sv_mask = alpha > 1e-5
            support_alpha = alpha[sv_mask]
            support_y = y_bin[sv_mask]
            support_X = X[sv_mask]
            K_sv = self._rbf_kernel(X, support_X, gamma)
            decision_train = K_sv @ (support_alpha * support_y)
            bias = np.mean(y_bin - decision_train)
            self.classifiers[cls] = {
                'alpha': support_alpha,
                'y_bin': support_y,
                'sv': support_X,
                'bias': bias
            }
        return self

    def predict(self, X):
        X = np.array(X, dtype=float)
        scores = np.zeros((len(X), len(self.classes_)))
        for i, cls in enumerate(self.classes_):
            clf = self.classifiers[cls]
            K = self._rbf_kernel(X, clf['sv'], self.gamma)
            scores[:, i] = K @ (clf['alpha'] * clf['y_bin']) + clf['bias']
        return self.classes_[np.argmax(scores, axis=1)]


class ManualGradientBoosting:
    def __init__(self, n_estimators=100, learning_rate=0.1, max_depth=4):
        self.n_estimators = n_estimators
        self.learning_rate = learning_rate
        self.max_depth = max_depth
        self.classes_ = None
        self.estimators = []
        self.init_scores = None

    def _softmax(self, F):
        F_shift = F - np.max(F, axis=1, keepdims=True)
        exp_F = np.exp(F_shift)
        return exp_F / np.sum(exp_F, axis=1, keepdims=True)

    def _one_hot(self, y, n_classes):
        OHE = np.zeros((len(y), n_classes))
        OHE[np.arange(len(y)), y] = 1
        return OHE

    def fit(self, X, y):
        X = np.array(X, dtype=float)
        y = np.array(y, dtype=int)
        self.classes_ = np.unique(y)
        n_classes = len(self.classes_)
        n_samples = len(y)
        Y_ohe = self._one_hot(y, n_classes)
        class_counts = np.array([np.sum(y == c) for c in self.classes_], dtype=float)
        self.init_scores = np.log(class_counts / class_counts.sum())
        F = np.tile(self.init_scores, (n_samples, 1))
        self.estimators = []
        for m in range(self.n_estimators):
            P = self._softmax(F)
            residuals = Y_ohe - P
            trees_k = []
            for k in range(n_classes):
                r_k = residuals[:, k]
                tree = ManualDecisionTree(max_depth=self.max_depth, min_samples_split=5)
                tree.fit(X, (r_k > 0).astype(int))
                leaf_preds = tree.predict(X)
                F[:, k] += self.learning_rate * (r_k * (leaf_preds == 1) - r_k * (leaf_preds == 0))
                trees_k.append(tree)
            self.estimators.append(trees_k)
        return self

    def predict(self, X):
        X = np.array(X, dtype=float)
        n_samples = len(X)
        n_classes = len(self.classes_)
        F = np.tile(self.init_scores, (n_samples, 1))
        for trees_k in self.estimators:
            for k, tree in enumerate(trees_k):
                preds = tree.predict(X)
                F[:, k] += self.learning_rate * (2 * preds - 1) * 0.5
        return self.classes_[np.argmax(F, axis=1)]
