---
layout: blog-post
sfx_blog: true
featured: false
title: "AI Support Agent Without an LLM: TF-IDF in Apex"
seo_title: "AI Agent Without LLM in Salesforce: TF-IDF Apex Guide"
description: "Build an AI agent without LLM in Salesforce: rank Knowledge articles with TF-IDF and cosine similarity in Apex. Full code, tests and Flow setup."
date: 2026-11-27 06:44:00 +0530
last_modified_at: 2026-11-27 06:44:00 +0530
permalink: /blog/ai-agent-without-llm-tfidf-cosine-similarity-apex/
primary_category: "Salesforce + AI"
series: "AI for Salesforce without LLM"
categories:
  - salesforce-ai
tags:
  - AI agent without LLM Salesforce
  - TF-IDF Apex
  - cosine similarity Apex
  - Salesforce Knowledge search
  - Apex invocable action
  - support deflection
  - Salesforce AI without LLM
reading_time: "12 min read"
og_type: article
author_name: "Abhay Nama"
author_url: "https://www.linkedin.com/in/abhay-nama-0739793a7/"
image: /assets/images/blog/ai-agent-without-llm-tfidf-cosine-similarity-apex.jpg
image_alt: "SFX Salesforce + AI Guide banner: cosine similarity in pure Apex with no external callouts"
proficiency: "Intermediate"
answer: "Build a Salesforce support agent without an LLM by converting Knowledge articles and the user's question into TF-IDF vectors, then ranking articles by cosine similarity in Apex. A high score returns the article, a medium score suggests a short list, and a low score escalates. It needs no callout, API key or Named Credential."
faq:
  - q: "Is TF-IDF good enough for Salesforce Knowledge search?"
    a: "For FAQ-style support where users reuse the words in your article titles and summaries, yes. It ranks by shared weighted words, so it is weaker when users paraphrase. Measure it on 30 to 50 real past questions before you rely on it."
  - q: "Does the Apex TF-IDF agent send Knowledge data outside Salesforce?"
    a: "No. Scoring runs inside the Apex transaction with no callout, so article text and the user's question stay in the org. If you later add an external LLM for low-confidence questions, record data would leave Salesforce, so review your privacy and data-processing terms first."
  - q: "When is TF-IDF not enough and I need an LLM or embeddings?"
    a: "TF-IDF only matches shared words, so it misses synonyms and paraphrases such as 'can't sign in' versus 'login failed'. If users phrase questions very differently from your articles, or you need generated answers, add embeddings, Data Cloud retrieval or an LLM."
  - q: "Will this hit Apex governor limits?"
    a: "It can if the corpus is large. The index is built inside the transaction, so CPU time and heap grow with the number of articles and their length. Keep the corpus to short, published articles and measure in a sandbox before going live."
  - q: "Does this need Agentforce or any paid AI license?"
    a: "No AI add-on is used. The code is standard Apex plus an invocable action you can call from Flow, and it does not use Agentforce, Prompt Builder or the Models API. It does read Knowledge articles, which need Lightning Knowledge and the right user licence and access."
extra_css:
  - /assets/css/blog.css
toc:
  - id: build-agent-without-llm
    label: "Build an agent without an LLM"
  - id: when-skip-llm
    label: "When to skip the LLM"
  - id: prerequisites
    label: "Prerequisites"
  - id: how-tfidf-works
    label: "How TF-IDF and cosine work"
  - id: build-steps
    label: "Build it step by step"
  - id: test-class
    label: "Test class"
  - id: wire-flow
    label: "Wire it into a Flow"
  - id: tune-thresholds
    label: "Tune the thresholds"
  - id: cost-limits
    label: "Cost and limits"
  - id: common-errors
    label: "Common errors and fixes"
  - id: official-sources
    label: "Official sources"
  - id: solution-kit
    label: "Solution kit"
---

A support team has 300 Knowledge articles and a queue full of "how do I reset my password" cases. Someone suggests an AI agent, and the next questions are about licences, API keys, data privacy and monthly cost. Often the real need is simpler: find the right existing article fast, and hand off to a person when nothing fits. That job does not need a language model.

## How do I build an AI agent without an LLM in Salesforce?
{: #build-agent-without-llm}

Build a retrieval agent in Apex: index published Knowledge articles as TF-IDF vectors, score the user's question against them with cosine similarity, and let a confidence rule decide between answering, suggesting and escalating. It has three parts:

1. **An index.** Every published Knowledge article becomes a TF-IDF vector (a list of weighted words).
2. **A matcher.** The user's question becomes a vector in the same space. Cosine similarity scores it against every loaded article.
3. **A decision rule.** A high score returns the article, a medium score returns a short list, and a low score escalates.

All of this is plain Apex. There is no callout, so there is nothing to put in a Named Credential or External Credential. If you later add an LLM, the [Claude API from Apex guide](/blog/call-claude-api-from-apex/) shows the credential setup.

The result behaves like an agent from the user's side: they ask a question and get an answer or a clear handoff. Underneath it is search with a confidence gate. That is a feature. You can explain every answer by pointing at the words that matched.

## When should I skip the LLM and use TF-IDF instead?
{: #when-skip-llm}

Use TF-IDF when answers already exist, wording overlaps with your articles, and you want predictable behaviour. Use an LLM or embeddings when users paraphrase heavily or you need generated text.

| Need | TF-IDF + cosine (this post) | Embeddings / Data Cloud RAG | LLM generation |
|---|---|---|---|
| Finds an existing article | Yes, on shared words | Yes, on meaning | Yes, if given context |
| Handles synonyms and paraphrase | Weak | Strong | Strong |
| Writes a new answer | No | No | Yes |
| External callout and credential | None | Depends on the setup | Depends on the integration (the Models API is available from Apex) |
| Per-request cost | None for scoring | Depends on the setup | Depends on the billing arrangement (per token, or Einstein Requests for the Models API) |
| Same input gives same output | Yes, for the same articles and thresholds | Mostly | Not guaranteed |
| Explain why it matched | Easy (matching terms) | Hard | Hard |
| Data leaves Salesforce | No | Depends on the setup | Depends on the setup |

For a hybrid, use TF-IDF as the cheap first pass. Send only low-confidence questions to a model, and keep a human in the loop as described in [A Production-Safe Salesforce AI Case Summary Pattern](/blog/salesforce-ai-case-summary-human-review/). Sending a question to an external model is a data-privacy decision, so check what record data goes with it.

## What do I need before I start?
{: #prerequisites}

- A sandbox or Developer Edition org. Do not build this first in production.
- Lightning Knowledge enabled, with the default article object `Knowledge__kav`. In Setup, search for **Knowledge Settings** to check this. If your org uses a different setup, confirm the object API name first.
- A handful of published articles in the language you query (the code uses `en_US`).
- Salesforce CLI (`sf`) and a project in SFDX layout.
- Knowledge access for the running user. Typically that means the **Knowledge User** feature license on the user record, Read access to the Knowledge object, and the **View Articles** permission. Requirements differ by org setup, so verify them in your org, including what the user can see with `PublishStatus = 'Online'`, before granting access.
- A permission set that gives the running user access to the Apex classes below.

The loader reads only `Title`, `Summary` and `UrlName`. `Summary` is a standard field but has a length limit, so for full body text you would add a custom long text field and extend the query. I could not confirm a single field name for article body that works in every org, so the code does not guess one.

## How do TF-IDF and cosine similarity work?
{: #how-tfidf-works}

TF-IDF gives each word a weight that is high when the word is frequent in one article and rare across all articles. Cosine similarity then compares the question's weighted words with each article's. The steps:

**Tokenize.** Lowercase the text, remove punctuation, split on spaces, drop stop words ("the", "how", "my") and apply a light suffix stemmer so "passwords" and "password" match.

**TF (term frequency).** How often a word appears in one document. The code uses `1 + ln(count)` so a word repeated ten times does not drown out everything else.

**IDF (inverse document frequency).** How rare the word is across all articles. The code uses `ln((1 + N) / (1 + df)) + 1`, where `N` is the number of articles and `df` is how many contain the word. "password" in 2 of 300 articles gets a high weight. "account" in 250 gets a low one.

**Weight and normalise.** Each term weight is `tf * idf`. Divide every weight by the vector's length so every article has length 1.

**Cosine similarity.** With unit-length vectors, cosine is the dot product. A score of 0 means no shared weighted terms. A score of 1 means the two vectors point in the same direction after preprocessing. It does not guarantee identical wording, because stop words, stemming and unknown terms are removed first.

**Unknown words.** A question word that appears in no article cannot be weighted. If the engine simply dropped it, "delete account" would score the same as "account". So the engine multiplies the score by the share of the question's distinct terms that exist in the corpus. A question made only of unknown words scores zero, and a mixed question is penalised.

The title is repeated twice before indexing, which gives title words more weight than body words. That is a simple, common tweak, not a rule.

## How do I build it step by step?
{: #build-steps}

The build is four steps: a tokenizer, a scoring engine, an invocable service that loads Knowledge and applies the decision rule, and the metadata files. Each is a plain Apex class you deploy with the Salesforce CLI.

### Step 1: Create the tokenizer

In your project, create `force-app/main/default/classes/TfIdfTokenizer.cls`.

```apex
public with sharing class TfIdfTokenizer {

    private static final Set<String> STOP_WORDS = new Set<String>{
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does',
        'for', 'from', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on',
        'or', 'our', 'the', 'this', 'that', 'to', 'we', 'what', 'when', 'where',
        'why', 'with', 'you', 'your', 'use', 'please', 'help'
    };

    public static List<String> tokenize(String text) {
        List<String> tokens = new List<String>();
        if (String.isBlank(text)) {
            return tokens;
        }
        String cleaned = text.toLowerCase().replaceAll('[^a-z0-9\\s]', ' ');
        for (String raw : cleaned.split('\\s+')) {
            if (raw.length() < 2 || STOP_WORDS.contains(raw)) {
                continue;
            }
            tokens.add(stem(raw));
        }
        return tokens;
    }

    // Deliberately simple. It only needs to be consistent between
    // the documents and the question, not linguistically perfect.
    @TestVisible
    private static String stem(String word) {
        if (word.length() > 5 && word.endsWith('ing')) {
            return word.substring(0, word.length() - 3);
        }
        if (word.length() > 5 && word.endsWith('ed')) {
            return word.substring(0, word.length() - 2);
        }
        if (word.length() > 3 && word.endsWith('s') && !word.endsWith('ss')) {
            return word.substring(0, word.length() - 1);
        }
        return word;
    }
}
```

### Step 2: Create the TF-IDF engine

Create `TfIdfEngine.cls`. It builds the index once in the constructor and answers any number of questions afterwards. Equal scores are ordered by article `Id`, so results are stable for the same corpus.

```apex
public with sharing class TfIdfEngine {

    public class Doc {
        public String id;
        public String title;
        public String text;
        public String url;

        public Doc(String id, String title, String text, String url) {
            this.id = id;
            this.title = title;
            this.text = text;
            this.url = url;
        }
    }

    public class Match implements Comparable {
        public Doc doc;
        public Double score;

        public Match(Doc doc, Double score) {
            this.doc = doc;
            this.score = score;
        }

        // Highest score first; equal scores fall back to Id so order is stable
        public Integer compareTo(Object other) {
            Match o = (Match) other;
            if (score == o.score) {
                String a = doc.id == null ? '' : doc.id;
                String b = o.doc.id == null ? '' : o.doc.id;
                return a.compareTo(b);
            }
            return score > o.score ? -1 : 1;
        }
    }

    private final List<Doc> docs;
    private final List<Map<String, Double>> vectors = new List<Map<String, Double>>();
    private final Map<String, Double> idf = new Map<String, Double>();

    public TfIdfEngine(List<Doc> docs) {
        this.docs = docs == null ? new List<Doc>() : docs;
        build();
    }

    private void build() {
        List<Map<String, Integer>> counts = new List<Map<String, Integer>>();
        Map<String, Integer> docFreq = new Map<String, Integer>();

        for (Doc d : docs) {
            // Title twice so title words weigh more than body words
            String combined = d.title + ' ' + d.title + ' ' + (d.text == null ? '' : d.text);
            Map<String, Integer> tf = new Map<String, Integer>();
            for (String t : TfIdfTokenizer.tokenize(combined)) {
                Integer c = tf.get(t);
                tf.put(t, c == null ? 1 : c + 1);
            }
            for (String term : tf.keySet()) {
                Integer df = docFreq.get(term);
                docFreq.put(term, df == null ? 1 : df + 1);
            }
            counts.add(tf);
        }

        Integer n = docs.size();
        for (String term : docFreq.keySet()) {
            idf.put(term, Math.log((1.0 + n) / (1.0 + docFreq.get(term))) + 1.0);
        }

        for (Map<String, Integer> tf : counts) {
            vectors.add(weigh(tf));
        }
    }

    // Turns term counts into a unit-length TF-IDF vector.
    // Terms that never appeared in the corpus are skipped here;
    // search() penalises the score for them.
    private Map<String, Double> weigh(Map<String, Integer> tf) {
        Map<String, Double> vec = new Map<String, Double>();
        Double sumSquares = 0;
        for (String term : tf.keySet()) {
            Double termIdf = idf.get(term);
            if (termIdf == null) {
                continue;
            }
            Double w = (1.0 + Math.log(tf.get(term))) * termIdf;
            vec.put(term, w);
            sumSquares += w * w;
        }
        if (sumSquares > 0) {
            Double norm = Math.sqrt(sumSquares);
            for (String term : vec.keySet()) {
                vec.put(term, vec.get(term) / norm);
            }
        }
        return vec;
    }

    public List<Match> search(String question, Integer topK) {
        List<Match> results = new List<Match>();
        Map<String, Integer> qCounts = new Map<String, Integer>();
        for (String t : TfIdfTokenizer.tokenize(question)) {
            Integer c = qCounts.get(t);
            qCounts.put(t, c == null ? 1 : c + 1);
        }
        Map<String, Double> q = weigh(qCounts);
        if (q.isEmpty()) {
            return results;
        }
        // Share of the question's distinct terms that exist in the corpus.
        // "delete account" with "delete" unknown gets 0.5, not 1.0.
        Double coverage = 1.0 * q.size() / qCounts.size();

        for (Integer i = 0; i < docs.size(); i++) {
            Map<String, Double> dv = vectors[i];
            Double dot = 0;
            for (String term : q.keySet()) {
                Double dw = dv.get(term);
                if (dw != null) {
                    dot += q.get(term) * dw;
                }
            }
            if (dot > 0) {
                results.add(new Match(docs[i], dot * coverage));
            }
        }

        results.sort();
        Integer limitTo = Math.min(topK, results.size());
        List<Match> top = new List<Match>();
        for (Integer i = 0; i < limitTo; i++) {
            top.add(results[i]);
        }
        return top;
    }
}
```

A question produces an empty vector, and therefore a score of zero, only when none of its terms occur in the corpus. A question that mixes known and unknown words still gets scored, but the coverage factor lowers its score so it is less likely to pass the answer threshold.

### Step 3: Create the invocable service

Create `SupportAgentService.cls`. It loads published articles with dynamic SOQL, so the class still compiles in orgs where Knowledge is not enabled. `AccessLevel.USER_MODE` makes the query respect the running user's access. If that access is missing, the query throws, and the service returns an `ERROR` decision with a message instead of pretending there were no matches.

```apex
public with sharing class SupportAgentService {

    public static final Double ANSWER_THRESHOLD = 0.35;
    public static final Double SUGGEST_THRESHOLD = 0.20;
    public static final Double MIN_MARGIN = 0.05;
    public static final Integer MAX_ARTICLES = 2000;

    @TestVisible
    private static List<TfIdfEngine.Doc> corpusOverride;
    @TestVisible
    private static Boolean corpusTruncated = false;

    public class Request {
        @InvocableVariable(label='Question' required=true)
        public String question;
    }

    public class Response {
        @InvocableVariable(label='Decision')
        public String decision; // ANSWER, SUGGEST, ESCALATE or ERROR
        @InvocableVariable(label='Best Article Title')
        public String title;
        @InvocableVariable(label='Best Article Summary')
        public String summary;
        @InvocableVariable(label='Best Article Id')
        public String articleId;
        @InvocableVariable(label='Best Article Url Name')
        public String urlName;
        @InvocableVariable(label='Score')
        public Decimal score;
        @InvocableVariable(label='Other Suggestions')
        public String suggestions;
        @InvocableVariable(label='Message')
        public String message;
        @InvocableVariable(label='Corpus Truncated')
        public Boolean corpusTruncated;
    }

    @InvocableMethod(
        label='Answer Support Question (TF-IDF)'
        description='Ranks published Knowledge articles by TF-IDF cosine similarity. No LLM and no callout.'
    )
    public static List<Response> answer(List<Request> requests) {
        List<Response> out = new List<Response>();
        if (requests == null || requests.isEmpty()) {
            return out;
        }

        List<TfIdfEngine.Doc> corpus;
        try {
            corpus = loadCorpus();
        } catch (QueryException e) {
            // Missing object or field access, or Knowledge not enabled.
            // Report it; do not treat it as "no matches".
            for (Request r : requests) {
                Response err = new Response();
                err.decision = 'ERROR';
                err.score = 0;
                err.message = 'Knowledge could not be read for this user: ' + e.getMessage();
                out.add(err);
            }
            return out;
        }

        TfIdfEngine engine = new TfIdfEngine(corpus);
        for (Request r : requests) {
            Response res = decide(engine.search(r == null ? null : r.question, 3));
            res.corpusTruncated = corpusTruncated;
            if (corpus.isEmpty()) {
                res.message = 'No published articles are visible to this user. Check language, publish status and access.';
            } else if (corpusTruncated) {
                res.message = 'Only the first ' + MAX_ARTICLES + ' articles (ordered by Id) were searched.';
            }
            out.add(res);
        }
        return out;
    }

    @TestVisible
    private static Response decide(List<TfIdfEngine.Match> matches) {
        Response res = new Response();
        res.decision = 'ESCALATE';
        res.score = 0;
        if (matches == null || matches.isEmpty()) {
            return res;
        }
        TfIdfEngine.Match best = matches[0];
        Double second = matches.size() > 1 ? matches[1].score : 0;

        res.title = best.doc.title;
        res.summary = String.isBlank(best.doc.text)
            ? 'Open the article for details.'
            : best.doc.text;
        res.articleId = best.doc.id;
        res.urlName = best.doc.url;
        res.score = Decimal.valueOf(best.score).setScale(4);

        if (best.score >= ANSWER_THRESHOLD && (best.score - second) >= MIN_MARGIN) {
            res.decision = 'ANSWER';
        } else if (best.score >= SUGGEST_THRESHOLD) {
            res.decision = 'SUGGEST';
        }

        if (res.decision != 'ESCALATE') {
            List<String> names = new List<String>();
            for (Integer i = 1; i < matches.size(); i++) {
                if (matches[i].score >= SUGGEST_THRESHOLD) {
                    names.add(matches[i].doc.title);
                }
            }
            res.suggestions = String.join(names, '; ');
        }
        return res;
    }

    @TestVisible
    private static List<TfIdfEngine.Doc> loadCorpus() {
        corpusTruncated = false;
        if (corpusOverride != null) {
            return corpusOverride;
        }
        List<TfIdfEngine.Doc> docs = new List<TfIdfEngine.Doc>();
        // ORDER BY Id keeps the loaded set stable. We ask for one extra row
        // so we can tell when the cap cut the corpus short.
        String soql = 'SELECT Id, Title, Summary, UrlName FROM Knowledge__kav '
            + 'WHERE PublishStatus = \'Online\' AND Language = \'en_US\' '
            + 'ORDER BY Id LIMIT ' + (MAX_ARTICLES + 1);
        List<SObject> rows = Database.query(soql, AccessLevel.USER_MODE);
        corpusTruncated = rows.size() > MAX_ARTICLES;
        for (Integer i = 0; i < Math.min(rows.size(), MAX_ARTICLES); i++) {
            SObject rec = rows[i];
            docs.add(new TfIdfEngine.Doc(
                (String) rec.get('Id'),
                (String) rec.get('Title'),
                (String) rec.get('Summary'),
                (String) rec.get('UrlName')
            ));
        }
        return docs;
    }
}
```

Design choices to note. The engine is built once per call, not once per question, so a bulk Flow run stays cheap. The `MIN_MARGIN` check stops the agent from confidently answering when two articles score almost the same. It shows a list instead. If more than `MAX_ARTICLES` articles match the query, the service searches only the first 2,000 by `Id` and says so in `message` and `corpusTruncated`, rather than hiding the cut.

### Step 4: Add the metadata files

Each class needs a `-meta.xml` file next to it. They are listed in the [Solution kit](#solution-kit) with the exact content.

## How do I test it with assertions?
{: #test-class}

Most tests use in-memory documents through `corpusOverride`, so they need no Knowledge data. Two sandbox integration tests exercise the real Knowledge query and the permission-denied path, and they skip themselves when Knowledge is not enabled. Create `TfIdfEngineTest.cls` and `SupportAgentServiceTest.cls`.

```apex
@IsTest
private class TfIdfEngineTest {

    private static List<TfIdfEngine.Doc> docs() {
        return new List<TfIdfEngine.Doc>{
            new TfIdfEngine.Doc('1', 'Reset your password',
                'Use the Forgot Your Password link on the login page to reset your password by email.', 'reset-password'),
            new TfIdfEngine.Doc('2', 'Change your email address',
                'Open your profile settings and update the email address linked to your account.', 'change-email'),
            new TfIdfEngine.Doc('3', 'Export a report to Excel',
                'Open the report, choose Export, and select the Excel format to download the data.', 'export-report')
        };
    }

    @IsTest
    static void tokenizerDropsStopWordsAndStems() {
        List<String> tokens = TfIdfTokenizer.tokenize('How do I reset my Passwords?');
        System.assertEquals(new List<String>{ 'reset', 'password' }, tokens);
    }

    @IsTest
    static void tokenizerHandlesBlank() {
        System.assertEquals(0, TfIdfTokenizer.tokenize(null).size());
        System.assertEquals(0, TfIdfTokenizer.tokenize('   ').size());
    }

    @IsTest
    static void bestMatchIsPasswordArticle() {
        Test.startTest();
        TfIdfEngine engine = new TfIdfEngine(docs());
        List<TfIdfEngine.Match> results = engine.search('I forgot my password, how do I reset it', 3);
        Test.stopTest();
        System.assert(!results.isEmpty(), 'Expected at least one match');
        System.assertEquals('1', results[0].doc.id);
        System.assert(results[0].score > 0 && results[0].score <= 1.0001, 'Score must be in (0, 1]');
    }

    @IsTest
    static void exportQuestionFindsExportArticle() {
        Test.startTest();
        TfIdfEngine engine = new TfIdfEngine(docs());
        List<TfIdfEngine.Match> results = engine.search('export my report to excel', 3);
        Test.stopTest();
        System.assertEquals('3', results[0].doc.id);
    }

    @IsTest
    static void unrelatedQuestionReturnsNoMatches() {
        Test.startTest();
        TfIdfEngine engine = new TfIdfEngine(docs());
        Integer unrelated = engine.search('quantum entanglement spaceship', 3).size();
        Integer blank = engine.search('', 3).size();
        Test.stopTest();
        System.assertEquals(0, unrelated);
        System.assertEquals(0, blank);
    }

    @IsTest
    static void unknownTermsLowerTheScore() {
        Test.startTest();
        TfIdfEngine engine = new TfIdfEngine(docs());
        Double known = engine.search('email', 3)[0].score;
        Double mixed = engine.search('email spaceship', 3)[0].score;
        Test.stopTest();
        System.assert(mixed < known, 'A question with an unknown term must score lower than the known-only question');
    }

    @IsTest
    static void emptyCorpusDoesNotFail() {
        Test.startTest();
        TfIdfEngine engine = new TfIdfEngine(new List<TfIdfEngine.Doc>());
        Integer size = engine.search('reset password', 3).size();
        Test.stopTest();
        System.assertEquals(0, size);
    }

    @IsTest
    static void resultsAreSortedHighestFirst() {
        Test.startTest();
        TfIdfEngine engine = new TfIdfEngine(docs());
        List<TfIdfEngine.Match> results = engine.search('email password account', 3);
        Test.stopTest();
        for (Integer i = 1; i < results.size(); i++) {
            System.assert(results[i - 1].score >= results[i].score, 'Results must be sorted descending');
        }
    }

    @IsTest
    static void equalScoresAreOrderedById() {
        List<TfIdfEngine.Match> ms = new List<TfIdfEngine.Match>{
            new TfIdfEngine.Match(new TfIdfEngine.Doc('b', 'B', '', 'b'), 0.5),
            new TfIdfEngine.Match(new TfIdfEngine.Doc('a', 'A', '', 'a'), 0.5)
        };
        Test.startTest();
        ms.sort();
        Test.stopTest();
        System.assertEquals('a', ms[0].doc.id);
    }
}
```

```apex
@IsTest
private class SupportAgentServiceTest {

    private static void seed() {
        SupportAgentService.corpusOverride = new List<TfIdfEngine.Doc>{
            new TfIdfEngine.Doc('1', 'Reset your password',
                'Use the Forgot Your Password link on the login page to reset your password by email.', 'reset-password'),
            new TfIdfEngine.Doc('2', 'Export a report to Excel',
                'Open the report, choose Export, and select the Excel format to download the data.', 'export-report')
        };
    }

    private static SupportAgentService.Request req(String q) {
        SupportAgentService.Request r = new SupportAgentService.Request();
        r.question = q;
        return r;
    }

    private static TfIdfEngine.Match m(String id, Double score) {
        return new TfIdfEngine.Match(new TfIdfEngine.Doc(id, 'Title ' + id, 'Summary ' + id, 'u' + id), score);
    }

    @IsTest
    static void goodQuestionIsNotEscalated() {
        seed();
        Test.startTest();
        List<SupportAgentService.Response> out =
            SupportAgentService.answer(new List<SupportAgentService.Request>{ req('how do I reset my password') });
        Test.stopTest();
        System.assertEquals(1, out.size());
        System.assertNotEquals('ESCALATE', out[0].decision);
        System.assertEquals('1', out[0].articleId);
        System.assert(out[0].score > 0, 'Score should be positive');
    }

    @IsTest
    static void unrelatedQuestionEscalates() {
        seed();
        Test.startTest();
        List<SupportAgentService.Response> out =
            SupportAgentService.answer(new List<SupportAgentService.Request>{ req('quantum entanglement spaceship') });
        Test.stopTest();
        System.assertEquals('ESCALATE', out[0].decision);
        System.assertEquals(0, out[0].score);
        System.assertEquals(null, out[0].articleId);
    }

    @IsTest
    static void blankQuestionEscalates() {
        seed();
        Test.startTest();
        List<SupportAgentService.Response> out =
            SupportAgentService.answer(new List<SupportAgentService.Request>{ req(null) });
        Test.stopTest();
        System.assertEquals('ESCALATE', out[0].decision);
    }

    @IsTest
    static void bulkRequestsKeepOrder() {
        seed();
        Test.startTest();
        List<SupportAgentService.Response> out = SupportAgentService.answer(
            new List<SupportAgentService.Request>{ req('reset password'), req('export report excel') });
        Test.stopTest();
        System.assertEquals(2, out.size());
        System.assertEquals('1', out[0].articleId);
        System.assertEquals('2', out[1].articleId);
    }

    @IsTest
    static void emptyCorpusExplainsItself() {
        SupportAgentService.corpusOverride = new List<TfIdfEngine.Doc>();
        Test.startTest();
        List<SupportAgentService.Response> out =
            SupportAgentService.answer(new List<SupportAgentService.Request>{ req('reset password') });
        Test.stopTest();
        System.assertEquals('ESCALATE', out[0].decision);
        System.assert(out[0].message != null && out[0].message.contains('No published articles'));
    }

    @IsTest
    static void highScoreWithClearMarginAnswers() {
        Test.startTest();
        SupportAgentService.Response res = SupportAgentService.decide(
            new List<TfIdfEngine.Match>{ m('1', 0.60), m('2', 0.10) });
        Test.stopTest();
        System.assertEquals('ANSWER', res.decision);
        System.assertEquals('1', res.articleId);
    }

    @IsTest
    static void mediumScoreSuggests() {
        Test.startTest();
        SupportAgentService.Response res = SupportAgentService.decide(
            new List<TfIdfEngine.Match>{ m('1', 0.25), m('2', 0.21) });
        Test.stopTest();
        System.assertEquals('SUGGEST', res.decision);
        System.assertEquals('Title 2', res.suggestions);
    }

    @IsTest
    static void closeTopTwoScoresSuggestInsteadOfAnswer() {
        Test.startTest();
        SupportAgentService.Response res = SupportAgentService.decide(
            new List<TfIdfEngine.Match>{ m('1', 0.50), m('2', 0.48) });
        Test.stopTest();
        System.assertEquals('SUGGEST', res.decision, 'A margin tie must not be a confident ANSWER');
    }

    @IsTest
    static void lowPositiveScoreEscalates() {
        Test.startTest();
        SupportAgentService.Response res = SupportAgentService.decide(
            new List<TfIdfEngine.Match>{ m('1', 0.10) });
        Test.stopTest();
        System.assertEquals('ESCALATE', res.decision);
        System.assert(res.score > 0, 'Score is kept for logging even when escalating');
    }

    @IsTest
    static void thresholdsAreOrdered() {
        System.assert(SupportAgentService.ANSWER_THRESHOLD > SupportAgentService.SUGGEST_THRESHOLD);
    }

    // --- Integration tests: run in a Knowledge-enabled sandbox ---

    @IsTest
    static void loaderReadsPublishedKnowledgeArticle() {
        Schema.SObjectType kav = Schema.getGlobalDescribe().get('Knowledge__kav');
        if (kav == null) {
            return; // Knowledge not enabled in this org
        }
        SObject a = kav.newSObject();
        a.put('Title', 'Reset your password');
        a.put('UrlName', 'reset-password-it');
        a.put('Summary', 'Use the Forgot Your Password link.');
        insert a;
        Id articleId = (Id) Database.query(
            'SELECT KnowledgeArticleId FROM Knowledge__kav WHERE Id = \'' + a.Id + '\''
        )[0].get('KnowledgeArticleId');
        KbManagement.PublishingService.publishArticle(articleId, true);

        Test.startTest();
        List<SupportAgentService.Response> out =
            SupportAgentService.answer(new List<SupportAgentService.Request>{ req('reset password') });
        Test.stopTest();
        System.assertNotEquals('ERROR', out[0].decision, out[0].message);
        System.assertNotEquals(null, out[0].articleId, 'The published article should be found');
    }

    @IsTest
    static void userWithoutKnowledgeAccessGetsErrorNotEmptyResult() {
        Schema.SObjectType kav = Schema.getGlobalDescribe().get('Knowledge__kav');
        List<Profile> profiles = [SELECT Id FROM Profile WHERE Name = 'Minimum Access - Salesforce' LIMIT 1];
        if (kav == null || profiles.isEmpty()) {
            return; // needs Knowledge and the Minimum Access profile
        }
        User u = new User(
            Alias = 'noknow', Email = 'noknow@example.invalid', EmailEncodingKey = 'UTF-8',
            LastName = 'NoKnowledge', LanguageLocaleKey = 'en_US', LocaleSidKey = 'en_US',
            ProfileId = profiles[0].Id, TimeZoneSidKey = 'America/Los_Angeles',
            Username = 'noknow' + System.currentTimeMillis() + '@example.invalid'
        );
        insert u;
        System.runAs(u) {
            Test.startTest();
            List<SupportAgentService.Response> out =
                SupportAgentService.answer(new List<SupportAgentService.Request>{ req('reset password') });
            Test.stopTest();
            System.assertEquals('ERROR', out[0].decision);
        }
    }
}
```

I could not compile or run any of this code in an org while writing this post, including the two integration tests, so run them in your sandbox with the command in the Solution kit before you trust the thresholds. The integration tests need a Knowledge-enabled sandbox where the running user can create and publish articles. The profile name in the denied-access test may differ in your org. The unit tests avoid asserting exact scores on purpose, because those depend on your stop words and stemmer.

## How do I wire it into a Flow?
{: #wire-flow}

Create a Screen Flow with a question input, one Action element that calls the invocable action, and a Decision on the `decision` output. Name the Action element `AgentResult` so you can reference its outputs directly.

1. In Setup, go to **Process Automation > Flows** (or search **Flows** in Quick Find) and click **New Flow**.
2. Choose **Screen Flow**, then **Create**.
3. Add a **Screen** element with a **Long Text Area** component named `QuestionInput`.
4. Add an **Action** element. Search for **Answer Support Question (TF-IDF)**. Set the element's **API Name** to `AgentResult`. Set **Question** to `{!QuestionInput}`. The action's outputs are then available as `{!AgentResult.decision}`, `{!AgentResult.title}`, `{!AgentResult.summary}`, `{!AgentResult.articleId}`, `{!AgentResult.suggestions}` and `{!AgentResult.message}`. You do not need to map them to separate variables.
5. Connect the Action's **Fault** path to a screen that says something went wrong and offers "contact support", so an unexpected exception does not show a raw error.
6. Add a **Decision** element on `{!AgentResult.decision}`:
   - `ANSWER`: show a screen with `{!AgentResult.title}`, `{!AgentResult.summary}` and a link to the article (see below).
   - `SUGGEST`: show the best title and link, plus `{!AgentResult.suggestions}`.
   - `ERROR`: show `{!AgentResult.message}` to an admin-facing or support screen. This means Knowledge could not be read for the user. It is not the same as "no answer".
   - `ESCALATE` (default): create a **Case** with the question as the description, or show a "contact support" screen.
7. For the article link, add a **Display Text** component with rich text such as `<a href="/lightning/r/Knowledge__kav/{!AgentResult.articleId}/view" target="_blank">Open the article</a>`. That path works for internal Lightning users. For Experience Cloud or other audiences, build the link from `{!AgentResult.urlName}` using your site's article URL pattern. Test the link in the exact context where the Flow runs.
8. Save, activate, and add the Flow to a Lightning page: **Edit Page** in App Builder, then drag the **Flow** component onto the page.
9. Give users access: in Setup, open **Permission Sets**, edit your permission set, then **Apex Class Access**, and add `SupportAgentService`, `TfIdfEngine` and `TfIdfTokenizer`. Also confirm the Knowledge access listed in the prerequisites. Then test with a user who lacks Knowledge access and confirm you see the `ERROR` branch.

If you are unsure whether this belongs in Flow or Apex, the [Flow or Apex decision guide](/blog/salesforce-flow-vs-apex-decision-guide/) covers the trade-offs. Here, Flow owns the screens and Case creation, and Apex owns the scoring.

## How do I tune the thresholds?
{: #tune-thresholds}

Treat `0.35`, `0.20` and `0.05` as starting points, not proven numbers, and tune them against your own past questions. Start strict, because a wrong confident answer costs more than an unnecessary escalation.

1. Collect 30 to 50 real past questions and note which article each one should match.
2. Run them through `SupportAgentService.answer` in Anonymous Apex and log the score and decision.
3. Raise `ANSWER_THRESHOLD` if wrong articles are returned as answers. Lower it if good matches are escalated.
4. Look at questions that escalated but had a correct article. Often the fix is a better article title or adding the user's wording to the summary, not a lower threshold.
5. Review escalated questions weekly. They are a free list of missing articles.

## What are the cost and limits?
{: #cost-limits}

This implementation adds no LLM token charges and makes no callouts, but it still runs on your Salesforce licences and governor limits. The main limits are CPU time, heap and the article cap.

- **Cost:** no per-token or Einstein Request charges are added by this code. Knowledge licences, Apex and platform costs depend on your org's edition and contract, so check your contract and the official [Salesforce pricing](https://www.salesforce.com/pricing/) pages.
- **CPU time:** the index is rebuilt on every call. Cost grows with article count and article length. Apex has a synchronous CPU time limit per transaction (10,000 ms in the current Apex governor limits documentation; check the page in Official sources for your release).
- **Rows:** the loader reads at most 2,000 articles, ordered by `Id`. If more exist, the rest are not searched, and the response sets `corpusTruncated` and a `message`. The SOQL row limit per transaction is much higher, but CPU and heap will bite first.
- **Heap:** every article becomes a map of terms. Keep summaries short.
- **Scaling up:** if the corpus is large, options include caching documents, narrowing by data category or topic before scoring, or moving to Data Cloud retrieval. I did not benchmark a specific corpus size for this post, so measure in a full-copy or partial sandbox with realistic articles.

Also remember TF-IDF is language-specific. The code filters on `en_US` and the stop word list is English.

## Common errors and fixes
{: #common-errors}

Error wording can vary by release and context. The messages below are representative, so confirm the exact text in your org before you search for it.

### Knowledge object not supported

```text
System.QueryException: sObject type 'Knowledge__kav' is not supported.
```

**Cause:** Lightning Knowledge is not enabled in the org, or the article object has a different API name.

**Fix:** Enable Lightning Knowledge in Setup under **Knowledge Settings**, then confirm the object name in **Object Manager**. If your object name differs, change it in `loadCorpus()`. For tests, use `corpusOverride`. The service catches this `QueryException` and returns an `ERROR` decision.

### Field does not exist on the article

```text
System.QueryException: No such column 'Summary' on entity 'Knowledge__kav'. If you are attempting to use a custom field, be sure to append the '__c' after the custom field name. Please reference your WSDL or the describe call for the appropriate names.
```

**Cause:** The field in the query is not available on your article object, or the running user has no field-level access to it. A custom field may also be missing its `__c` suffix.

**Fix:** Check the field names in **Object Manager > Knowledge > Fields & Relationships** and the user's field access. Update the SOQL string and the `rec.get(...)` calls together.

### CPU limit exceeded

```text
System.LimitException: Apex CPU time limit exceeded
```

**Cause:** Too many or too long articles are being tokenized and scored in one transaction.

**Fix:** Reduce `MAX_ARTICLES`, index summaries instead of full bodies, filter articles by topic before scoring, or move retrieval to a platform feature built for scale.

### Every question escalates

```text
Decision: ESCALATE
Score: 0
```

This is the action's output, not a Salesforce error message.

**Cause:** The query returned no articles (wrong language filter or no published articles), or the question shares no words with any article. Missing access shows as `ERROR` with a message instead.

**Fix:** Read `{!AgentResult.message}`. Run the SOQL in Developer Console as the same user. Check `PublishStatus`, `Language` and sharing. Then compare the question's words with the article titles.

### Users cannot run the action

The exact message depends on where the user hits it, but it will say the user lacks access to the Apex class `SupportAgentService`.

**Cause:** The permission set does not include the Apex classes.

**Fix:** Add the classes under **Permission Sets > Apex Class Access**. For the access model behind this, see [Why can this user see the record?](/blog/why-salesforce-user-can-see-record/).

## Official sources
{: #official-sources}

- [Apex Developer Guide: Database class](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_methods_system_database.htm) (`Database.query` with `AccessLevel`)
- [Apex Developer Guide: InvocableMethod annotation](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_InvocableMethod.htm)
- [Apex Developer Guide: Execution Governors and Limits](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_gov_limits.htm)
- [Apex Developer Guide: Math class](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_methods_system_math.htm)
- [SOQL: ORDER BY](https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-orderby.html)
- [Object Reference: Knowledge__kav](https://developer.salesforce.com/docs/platform/object-reference/references/custom-objects/object-knowledge__kav.html)
- [Secure coding: CRUD and FLS](https://developer.salesforce.com/docs/platform/secure-coding/guide/secure-coding-access-control-protect-from-crud-fls-vulnerabilities.html)
- [Models API with Apex](https://developer.salesforce.com/docs/ai/agentforce/guide/access-models-api-with-apex) (if you add an LLM later)
- [Salesforce Help: Lightning Knowledge](https://help.salesforce.com/) (search "Set Up Lightning Knowledge" for your release)

Page paths change between releases, so confirm the current limits and menu names in your org's release.

Need this built in your org? [SFX can build it](/services/) with a written scope and fixed quote.

## Solution kit
{: #solution-kit}

Files, in SFDX layout:

```text
force-app/main/default/classes/TfIdfTokenizer.cls
force-app/main/default/classes/TfIdfTokenizer.cls-meta.xml
force-app/main/default/classes/TfIdfEngine.cls
force-app/main/default/classes/TfIdfEngine.cls-meta.xml
force-app/main/default/classes/SupportAgentService.cls
force-app/main/default/classes/SupportAgentService.cls-meta.xml
force-app/main/default/classes/TfIdfEngineTest.cls
force-app/main/default/classes/TfIdfEngineTest.cls-meta.xml
force-app/main/default/classes/SupportAgentServiceTest.cls
force-app/main/default/classes/SupportAgentServiceTest.cls-meta.xml
```

No Named Credential, External Credential, Remote Site Setting or custom object is needed, because the agent makes no callouts.

Use this content for each `-meta.xml` file (any currently supported API version works):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>65.0</apiVersion>
    <status>Active</status>
</ApexClass>
```

Deploy and verify:

```bash
sf project deploy start --source-dir force-app/main/default/classes --target-org mySandbox
sf apex run test --class-names TfIdfEngineTest --class-names SupportAgentServiceTest --result-format human --code-coverage --wait 10 --target-org mySandbox
```

After the tests pass, build the Flow from the steps above, assign the permission set, and run your 30 to 50 real questions to set your own thresholds.
