export interface PromptTemplate {
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[];
  examples?: PromptExample[];
}

export interface PromptExample {
  input: string;
  output: string;
  description: string;
}

export interface PromptContext {
  transcript: string;
  language?: string;
  maxLength?: number;
  summaryType?: 'summary' | 'topics' | 'action_items';
  meetingType?: string;
  participants?: string[];
  duration?: number;
}

export class PromptTemplateManager {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * テンプレートを初期化
   */
  private initializeTemplates(): void {
    // 議論要約テンプレート
    this.templates.set('meeting_summary', {
      name: '会議要約',
      description: '会議の内容を簡潔に要約します',
      systemPrompt: `あなたは会議の要約を専門とするアシスタントです。
以下の指示に従って、会議の内容を簡潔かつ正確に要約してください：

1. 重要な決定事項を明確に記載
2. 議論された主要なポイントを整理
3. 結論や次のステップを明示
4. 客観的で事実に基づいた要約を作成
5. 指定された文字数制限内でまとめる

要約は日本語で作成し、読みやすく構造化してください。`,
      userPromptTemplate: `以下の会議の文字起こしを要約してください：

【会議情報】
- 言語: {language}
- 最大文字数: {maxLength}文字
- 会議タイプ: {meetingType}
- 参加者: {participants}
- 会議時間: {duration}分

【文字起こし】
{transcript}

【要約】
`,
      variables: ['transcript', 'language', 'maxLength', 'meetingType', 'participants', 'duration'],
      examples: [
        {
          input: 'プロジェクトの進捗について話し合いました。Aさんが技術的な課題を報告し、Bさんがスケジュール調整を提案しました。',
          output: 'プロジェクト進捗会議で技術的課題の報告とスケジュール調整の提案が行われました。',
          description: '簡潔な要約例'
        }
      ]
    });

    // トピック抽出テンプレート
    this.templates.set('topic_extraction', {
      name: 'トピック抽出',
      description: '会議で議論された主要なトピックを抽出します',
      systemPrompt: `あなたは会議のトピック抽出を専門とするアシスタントです。
以下の指示に従って、会議で議論された主要なトピックを抽出してください：

1. 議論された主要なテーマを特定
2. 関連するサブトピックをグループ化
3. 重要度に基づいて優先順位付け
4. 明確で簡潔なトピック名を使用
5. 箇条書き形式で整理

トピックは日本語で作成し、会議の流れを反映した構造にしてください。`,
      userPromptTemplate: `以下の会議の文字起こしから主要なトピックを抽出してください：

【会議情報】
- 言語: {language}
- 最大トピック数: 10個
- 会議タイプ: {meetingType}
- 参加者: {participants}
- 会議時間: {duration}分

【文字起こし】
{transcript}

【主要なトピック】
`,
      variables: ['transcript', 'language', 'meetingType', 'participants', 'duration'],
      examples: [
        {
          input: 'プロジェクト計画、技術的な課題、スケジュール調整について話し合いました。',
          output: '• プロジェクト計画\n• 技術的課題\n• スケジュール調整',
          description: 'トピック抽出例'
        }
      ]
    });

    // アクションアイテム抽出テンプレート
    this.templates.set('action_items', {
      name: 'アクションアイテム抽出',
      description: '会議で決定されたアクションアイテムを抽出します',
      systemPrompt: `あなたは会議のアクションアイテム抽出を専門とするアシスタントです。
以下の指示に従って、会議で決定されたアクションアイテムを抽出してください：

1. 具体的なタスクや作業項目を特定
2. 担当者や責任者を明確化
3. 期限や優先度を記載
4. 実行可能で測定可能なアクションに焦点
5. 決定事項とアクションを区別

アクションアイテムは日本語で作成し、実行可能な形式で整理してください。`,
      userPromptTemplate: `以下の会議の文字起こしからアクションアイテムを抽出してください：

【会議情報】
- 言語: {language}
- 最大アイテム数: 15個
- 会議タイプ: {meetingType}
- 参加者: {participants}
- 会議時間: {duration}分

【文字起こし】
{transcript}

【アクションアイテム】
`,
      variables: ['transcript', 'language', 'meetingType', 'participants', 'duration'],
      examples: [
        {
          input: 'Aさんが技術仕様書を作成し、Bさんがチーム会議をスケジュールすると決まりました。',
          output: '• Aさん: 技術仕様書の作成\n• Bさん: チーム会議のスケジュール調整',
          description: 'アクションアイテム抽出例'
        }
      ]
    });

    // 議論分析テンプレート
    this.templates.set('discussion_analysis', {
      name: '議論分析',
      description: '会議の議論を詳細に分析します',
      systemPrompt: `あなたは会議の議論分析を専門とするアシスタントです。
以下の観点から会議の議論を分析してください：

1. 議論の質と深さ
2. 参加者の貢献度
3. 合意と対立点
4. 意思決定プロセス
5. 改善点と提案

分析は客観的で建設的な視点から行い、今後の会議改善に活用できる洞察を提供してください。`,
      userPromptTemplate: `以下の会議の文字起こしを分析してください：

【会議情報】
- 言語: {language}
- 会議タイプ: {meetingType}
- 参加者: {participants}
- 会議時間: {duration}分

【文字起こし】
{transcript}

【議論分析】
`,
      variables: ['transcript', 'language', 'meetingType', 'participants', 'duration']
    });

    // 議事録テンプレート
    this.templates.set('meeting_minutes', {
      name: '議事録作成',
      description: '正式な議事録を作成します',
      systemPrompt: `あなたは議事録作成を専門とするアシスタントです。
以下の形式で正式な議事録を作成してください：

【議事録の構成】
1. 会議概要（日時、参加者、議題）
2. 議事内容（各議題の詳細）
3. 決定事項
4. アクションアイテム（担当者、期限）
5. 次回会議予定

議事録は正確で読みやすく、後から参照できる形式で作成してください。`,
      userPromptTemplate: `以下の会議の文字起こしから正式な議事録を作成してください：

【会議情報】
- 言語: {language}
- 会議タイプ: {meetingType}
- 参加者: {participants}
- 会議時間: {duration}分

【文字起こし】
{transcript}

【議事録】
`,
      variables: ['transcript', 'language', 'meetingType', 'participants', 'duration']
    });
  }

  /**
   * テンプレートを取得
   */
  getTemplate(name: string): PromptTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * すべてのテンプレートを取得
   */
  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * テンプレート名のリストを取得
   */
  getTemplateNames(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * プロンプトを生成
   */
  generatePrompt(templateName: string, context: PromptContext): { systemPrompt: string; userPrompt: string } {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`テンプレートが見つかりません: ${templateName}`);
    }

    // デフォルト値を設定
    const defaults = {
      language: 'ja',
      maxLength: '500',
      meetingType: '一般会議',
      participants: '複数名',
      duration: '60',
    };

    // コンテキストをマージ
    const mergedContext = { ...defaults, ...context };

    // ユーザープロンプトの変数を置換
    let userPrompt = template.userPromptTemplate;
    for (const variable of template.variables) {
      const value = mergedContext[variable as keyof PromptContext] || '';
      userPrompt = userPrompt.replace(`{${variable}}`, String(value));
    }

    return {
      systemPrompt: template.systemPrompt,
      userPrompt,
    };
  }

  /**
   * 要約タイプに基づいてテンプレートを選択
   */
  getTemplateForSummaryType(summaryType: 'summary' | 'topics' | 'action_items'): string {
    switch (summaryType) {
      case 'summary':
        return 'meeting_summary';
      case 'topics':
        return 'topic_extraction';
      case 'action_items':
        return 'action_items';
      default:
        return 'meeting_summary';
    }
  }

  /**
   * カスタムテンプレートを追加
   */
  addTemplate(template: PromptTemplate): void {
    this.templates.set(template.name, template);
  }

  /**
   * テンプレートを削除
   */
  removeTemplate(name: string): boolean {
    return this.templates.delete(name);
  }

  /**
   * テンプレートを更新
   */
  updateTemplate(name: string, template: Partial<PromptTemplate>): boolean {
    const existing = this.templates.get(name);
    if (!existing) {
      return false;
    }

    this.templates.set(name, { ...existing, ...template });
    return true;
  }
} 
