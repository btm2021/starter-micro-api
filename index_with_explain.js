import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
const app = express();
const port = process.env.PORT || 3001; // Bạn có thể thay đổi cổng tùy ý

import morgan from 'morgan';

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

------------
SCHEMA: {schema}
------------
QUESTION: {question}
------------
SQL QUERY:`;

const prompt = PromptTemplate.fromTemplate(template);


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
    temperature: 0.5,
    openAIApiKey: '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'
});


const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
});
async function question(q) {

    /**
     * Create the first prompt template used for getting the SQL query.
     */
    let sqlP = `You are a Postgres expert. Given an input question, first create a syntactically correct Postgres query to run, then look at the results of the query and return the answer to the input question.
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
        question: q,
    });
    console.log({ res });
    let finalResponse = db.run(res)
//     const finalResponsePrompt =
//         PromptTemplate.fromTemplate(`
//         Based on the table schema below, the question, the SQL query, and the SQL response.
// Write the answer in natural language in Vietnamese.
//     ------------
//     SCHEMA: {schema}
//     ------------
//     QUESTION: {question}
//     ------------
//     SQL QUERY: {query}
//     ------------
//     SQL RESPONSE: {response}
//     ------------
//     NATURAL LANGUAGE RESPONSE:`);

//     const finalChain = RunnableSequence.from([
//         {
//             question: (input) => input.question,
//             query: sqlQueryChain,
//         },
//         {
//             schema: async () => db.getTableInfo(),
//             question: (input) => input.question,
//             query: (input) => input.query,
//             response: (input) => db.run(input.query),
//         },
//         finalResponsePrompt,
//         llm,
//         new StringOutputParser(),
//     ]);

//     const finalResponse = await finalChain.invoke({
//         question: q,
//     });

    console.log({ finalResponse });
    return new Promise((resolve, reject) => {
        resolve(finalResponse)
    })
}



app.use(cors());
app.use(morgan('tiny'));

app.use(bodyParser.json());

app.post('/api', async (req, res) => {
    // const question = req.body.questionFromUI;
    let qs = req.body.question
    if (qs != null && qs != '') {
        let q = qs
        console.log(qs)
        let sql = await question(q)
        res.json(sql)
    } else {
        res.json({ status: 404, message: 'Missing Q' })
    }

});


app.listen(port, () => {
    console.log(`Server đang chạy trên cổng ${port}`);
});
//question('tìm hóa đơn của khách hàng tên BAO')


