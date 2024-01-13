import * as http from "http"
http.createServer(async function (req, res) {

    res.setHeader('Access-Control-Allow-Origin', '*');
    let q = "lấy ra toàn bộ hóa đơn của khách tên BAO"
    let sql = await question(q)
    let resultQuery = await db.run(sql)
    let finalReturn = { question: q, sql, resultQuery }
    res.end(JSON.stringify(finalReturn));
}).listen(process.env.PORT || 3000);

import { DataSource } from "typeorm";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SqlDatabase } from "langchain/sql_db";
import { PromptTemplate } from "@langchain/core/prompts";
import {
    RunnablePassthrough,
    RunnableSequence,
} from "@langchain/core/runnables";
import { OpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import translate from "translate";

const template = `You are a Postgres expert. Given an input question, first create a syntactically correct Postgres query to run, then look at the results of the query and return the answer to the input question.
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
SQLQuery:`;

const prompt = PromptTemplate.fromTemplate(template);
const datasource = new DataSource({
    type: "postgres",
    host: "db.ajsrzteoovahabndebyp.supabase.co",
    port: 5432,
    username: "postgres",
    password: "trinhminhbao@1991",
    database: "postgres",
});

const llm = new OpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.7,
});


const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
});

async function question(q) {

    console.log(q)
    const textTrain = await translate(q, { to: "en", from: "vi" })
    //console.log(textTrain)


    const sqlQueryGeneratorChain = RunnableSequence.from([
        RunnablePassthrough.assign({
            schema: async () => db.getTableInfo(),
        }),
        prompt,
        llm.bind({ stop: ["\nSQLResult:"] }),
        new StringOutputParser(),
    ]);

    const result = await sqlQueryGeneratorChain.invoke({
        question: textTrain,
    });
    console.log(result)
    //chain giải thích

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

    const finalResponse = await finalChain.invoke({
        question,
    });

    console.log({ finalResponse });
    return new Promise((resolve, reject) => {

        resolve(result)
    })
}

question("tìm các hóa đơn của khách hàng tên BAO")


const finalResponsePrompt =
    PromptTemplate.fromTemplate(`Based on the table schema below, question, SQL query, and SQL response, write a natural language response as vietnamese language:
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

