import { DataSource } from "typeorm";
import { SqlDatabase } from "langchain/sql_db";
import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

const datasource = new DataSource({
    type: "postgres",
    host: "db.ajsrzteoovahabndebyp.supabase.co",
    port: 5432,
    username: "postgres",
    password: "trinhminhbao@1991",
    database: "postgres",
});


const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
});

const llm = new OpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.5,
    openAIApiKey: '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'
});

/**
 * Create the first prompt template used for getting the SQL query.
 */
let sqlP=`You are a Postgres expert. Given an input question, first create a syntactically correct Postgres query to run, then look at the results of the query and return the answer to the input question.
Always query for all columns from a table. Wrap each column name in double quotes (") to denote them as delimited identifiers.
Pay attention to use only the column names you can see in the tables below. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.
Pay attention to use date('now') function to get the current date, if the question involves "today".
Use the following format:

Question: <Question here>
SQLQuery: <SQL Query to run>
SQLResult: <Result of the SQLQuery>
Answer: <Final answer here>

Only use the following tables:

{schema}

QUESTION: {question}
SQLQuery:`
// const prompt =
//     PromptTemplate.fromTemplate(
//         `Based on the provided SQL table schema below, write a SQL query that would answer the user's question.
// ------------
// SCHEMA: {schema}
// ------------
// QUESTION: {question}
// ------------
// SQL QUERY:`);

const prompt = PromptTemplate.fromTemplate(sqlP);

const sqlQueryChain = RunnableSequence.from([
    {
        schema: async () => db.getTableInfo(),
        question: (input) => input.question,
    },
    prompt,
    llm.bind({ stop: ["\nSQLResult:"] }),
    new StringOutputParser(),
]);

const res = await sqlQueryChain.invoke({
    question: "How many employees are there?",
});
console.log({ res });

const finalResponsePrompt =
    PromptTemplate.fromTemplate(`You are a data analyst. Based on the table schema below, question, SQL query, and SQL response, write a natural language response as vietnamese.
------------
SCHEMA: {schema}
------------
QUESTION: {question}
------------
SQL QUERY: {query}
------------
SQL RESPONSE: {response}
------------
NATURAL LANGUAGE RESPONSE:`);

const finalChain = RunnableSequence.from([
    {
        question: (input) => input.question,
        query: sqlQueryChain,
    },
    {
        schema: async () => db.getTableInfo(),
        question: (input) => input.question,
        query: (input) => input.query,
        response: (input) => db.run(input.query),
    },
    finalResponsePrompt,
    llm,
    new StringOutputParser(),
]);

let q = "liệt kê 5 hóa đơn mới tạo gần đây dựa trên ngày tạo"
const finalResponse = await finalChain.invoke({
    question: q,
});

console.log({ finalResponse });
