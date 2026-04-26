# yooo this notes app is absolutely fuckin huge here WOAH ! its kind of laggy but hey it still works xD

### Phase 1: The Magic Wand Era (Euclidean Distance in Color Space)

Before "Quick Selection," there was the Magic Wand. Its math is essentially a thresholded flood-fill algorithm operating in a 3D color space.

When you click a pixel, the algorithm converts the RGB values into a perceptually uniform color space, usually CIE $L^*a^*b^*$. It then calculates the Euclidean distance ($\Delta E$) between the seed pixel ($1$) and an adjacent pixel ($2$):

$$\Delta E = \sqrt{(L_1 - L_2)^2 + (a_1 - a_2)^2 + (b_1 - b_2)^2}$$

If $\Delta E$ is less than the user-defined "Tolerance" threshold, the pixel is selected, and the algorithm recursively checks its neighbors.

- **The Problem:** It doesn't understand edges or textures. It just blindly eats pixels that are mathematical color-neighbors.

### Phase 2: True "Quick Selection" (Markov Random Fields & Graph Cuts)

When Adobe introduced the actual "Quick Selection" tool (around Photoshop CS3), they abandoned simple flood-filling. They reframed image selection as an **Energy Minimization Problem** on a Markov Random Field (MRF), largely based on the Boykov-Jolly algorithm.

This is where the math gets delightfully painful. The tool imagines your image as a directed graph where every pixel is a node. The goal is to assign a label $l_p$to every pixel $p$, where $l_p \in \{0, 1\}$ (0 = background, 1 = foreground).

The algorithm seeks to find the set of labels $L$ that minimizes the following energy function:

$$E(L) = \sum_{p \in \mathcal{P}} R_p(l_p) + \lambda \sum_{\{p,q\} \in \mathcal{N}} B_{p,q}(l_p, l_q)$$

Let's break down these two massive terms.

#### 1. The Regional Term (Data Penalty): $R_p(l_p)$

This term calculates how likely a pixel belongs to the foreground or background based on the colors you've already painted over. The algorithm builds a Gaussian Mixture Model (GMM) for both the foreground strokes and background strokes.

The penalty is the negative log-likelihood of the pixel's intensity $I_p$ belonging to the foreground or background histogram:

$$R_p(1) = -\ln \Pr(I_p \mid \text{Foreground})$$

$$R_p(0) = -\ln \Pr(I_p \mid \text{Background})$$

#### 2. The Boundary Term (Smoothness Penalty): $B_{p,q}(l_p, l_q)$

This term is the secret sauce that makes the brush "snap" to edges. It evaluates neighboring pixels ($p$ and $q$). If they are assigned different labels (one foreground, one background), it imposes a penalty. However, that penalty is *lower* if there is a sharp contrast (an edge) between them.

$$B_{p,q}(l_p, l_q) = \begin{cases} \exp\left(-\frac{(I_p - I_q)^2}{2\sigma^2}\right) \cdot \frac{1}{\text{dist}(p,q)} & \text{if } l_p \neq l_q \\ 0 & \text{if } l_p = l_q \end{cases}$$

- $I_p - I_q$ is the difference in intensity. If it's high (a hard edge), the exponential term approaches zero, making it "cheap" for the algorithm to make a cut there.
- $\sigma$ is image noise/variance.
- $\lambda$ (from the main equation) dictates how smooth the final boundary should be.

**The Solution (Max-Flow/Min-Cut):**

To solve this massive equation instantly, the computer creates two super-nodes: a Source (Foreground) and a Sink (Background). It pipes "flow" through the pixel graph. By applying the **Max-Flow/Min-Cut Theorem**, the algorithm severs the edges with the lowest capacity (the literal edges in your image), instantly minimizing $E(L)$ and snapping your selection into place.

### Phase 3: The Modern Evolution (Deep Learning & Transformers)

If you use a modern "Subject Selection" or Quick Selection tool today, Graph Cuts are dead. You are invoking massive Neural Networks—specifically, architectures similar to Meta's **Segment Anything Model (SAM)**.

The math is no longer about evaluating adjacent pixels; it’s about mapping high-dimensional semantic representations via tensor operations.

#### 1. The Vision Transformer (ViT) Image Encoder

Instead of looking at pixels, the image is chopped into $16 \times 16$ patches, flattened into vectors, and passed through a Transformer model. The core math here is the **Self-Attention Mechanism**, which allows the model to understand that a pixel on a dog's ear is mathematically related to a pixel on the dog's tail.

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

Where $Q$ (Query), $K$ (Key), and $V$ (Value) are weight matrices learned during the training of millions of images. The model generates a massive, rich image embedding (a highly compressed mathematical representation of the "meaning" of the image).

#### 2. The Prompt Encoder

When you click your brush, you create a spatial coordinate $(x,y)$. This coordinate undergoes **Positional Encoding** (often using sine and cosine functions) so the neural network can map your 2D click into the high-dimensional embedding space.

$$PE_{(pos, 2i)} = \sin\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right)$$

$$PE_{(pos, 2i+1)} = \cos\left(\frac{pos}{10000^{2i/d_{\text{model}}}}\right)$$

#### 3. The Mask Decoder & Focal Loss

The image embedding and your encoded brush clicks are combined in a lightweight decoder. The final output is a probability map where every pixel is assigned a value between $0.0$ and $1.0$ (representing the confidence that it belongs to your selection).

During training, these modern algorithms are optimized using **Focal Loss**, which forces the math to hyper-focus on the hardest-to-predict pixels (like strands of hair):

$$\text{FL}(p_t) = -\alpha_t (1 - p_t)^\gamma \log(p_t)$$

- $p_t$ is the model's predicted probability.
- $(1 - p_t)^\gamma$ is the modulating factor. If the model is highly confident (e.g., $p_t = 0.99$), this factor drops to near zero, ignoring the easy pixels and forcing the math to aggressively calculate the boundaries of fur, hair, and complex edges.

### The TL;DR of the Pain

You started by asking the computer to measure 3D triangles between colors (Magic Wand). Then, you asked it to calculate the cheapest way to flood a network of pipes with water while avoiding sharp drops (Graph Cuts). Today, when you drag that brush, you are triggering billions of floating-point matrix multiplications inside a Transformer model that understands "dog," "hair," and "background" mathematically before it even looks at the specific colors.

&nbsp;

yoooo tee hee